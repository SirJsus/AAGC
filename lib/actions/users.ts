"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { Permissions } from "@/lib/permissions"
import { Role } from "@prisma/client"
import bcrypt from "bcryptjs"

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  secondLastName: z.string().optional(),
  noSecondLastName: z.boolean().optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(Role),
  clinicId: z.string().optional(),
  // Doctor-specific fields
  specialty: z.string().optional(),
  licenseNumber: z.string().optional(),
  acronym: z.string().optional(),
  roomId: z.string().optional(),
})

const updateUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  secondLastName: z.string().optional(),
  noSecondLastName: z.boolean().optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(Role),
  clinicId: z.string().optional(),
  isActive: z.boolean(),
  // Doctor-specific fields
  specialty: z.string().optional(),
  licenseNumber: z.string().optional(),
  acronym: z.string().optional(),
  roomId: z.string().optional(),
})

export async function createUser(data: z.infer<typeof createUserSchema>) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user || !Permissions.canManageUsers(session.user)) {
    throw new Error("Unauthorized")
  }

  if (!Permissions.canCreateUser(session.user, data.role)) {
    throw new Error("Cannot create user with this role")
  }

  const validatedData = createUserSchema.parse(data)

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: validatedData.email }
  })

  if (existingUser) {
    throw new Error("User with this email already exists")
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(validatedData.password, 12)

  // Determine clinic ID
  let clinicId = validatedData.clinicId
  if (session.user.role !== Role.ADMIN) {
    clinicId = session.user.clinicId || undefined
  }

  // For doctors, clinicId is required
  if (validatedData.role === Role.DOCTOR && !clinicId) {
    throw new Error("Clinic is required for doctor role")
  }

  const user = await prisma.user.create({
    data: {
      email: validatedData.email,
      password: hashedPassword,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      secondLastName: validatedData.secondLastName,
      noSecondLastName: validatedData.noSecondLastName,
      phone: validatedData.phone || null,
      role: validatedData.role,
      clinicId: clinicId || null,
      specialty: validatedData.specialty || null,
      licenseNumber: validatedData.licenseNumber || null,
    },
    include: {
      clinic: true,
    },
  })

  // If user is a doctor, create a corresponding doctor record
  if (user.role === Role.DOCTOR) {
    // Generate acronym if not provided: Dr + initials of name and last names
    let acronym = validatedData.acronym
    if (!acronym) {
      const firstInitial = validatedData.firstName.charAt(0).toUpperCase()
      const lastInitial = validatedData.lastName.charAt(0).toUpperCase()
      const secondLastInitial = validatedData.secondLastName ? validatedData.secondLastName.charAt(0).toUpperCase() : ''
      acronym = `Dr${firstInitial}${lastInitial}${secondLastInitial}`
    }

    await prisma.doctor.create({
      data: {
        userId: user.id,
        clinicId: clinicId!,
        acronym: acronym,
        roomId: validatedData.roomId || null,
        isActive: true,
      },
    })
  }

  revalidatePath("/users")
  revalidatePath("/doctors")
  return user
}

export async function updateUser(userId: string, data: z.infer<typeof updateUserSchema>) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user || !Permissions.canManageUsers(session.user)) {
    throw new Error("Unauthorized")
  }

  const validatedData = updateUserSchema.parse(data)

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!existingUser) {
    throw new Error("User not found")
  }

  // Determine clinic ID
  let clinicId = validatedData.clinicId
  if (session.user.role !== Role.ADMIN) {
    clinicId = session.user.clinicId || undefined
  }

  // For doctors, clinicId is required
  if (validatedData.role === Role.DOCTOR && !clinicId) {
    throw new Error("Clinic is required for doctor role")
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      secondLastName: validatedData.secondLastName,
      noSecondLastName: validatedData.noSecondLastName,
      phone: validatedData.phone || null,
      role: validatedData.role,
      clinicId: clinicId || null,
      isActive: validatedData.isActive,
      specialty: validatedData.specialty || null,
      licenseNumber: validatedData.licenseNumber || null,
    },
    include: {
      clinic: true,
    },
  })

  // Generate acronym if not provided: Dr + initials of name and last names
  const generateAcronym = (firstName: string, lastName: string, secondLastName?: string) => {
    const firstInitial = firstName.charAt(0).toUpperCase()
    const lastInitial = lastName.charAt(0).toUpperCase()
    const secondLastInitial = secondLastName ? secondLastName.charAt(0).toUpperCase() : ''
    return `Dr${firstInitial}${lastInitial}${secondLastInitial}`
  }

  // Handle Doctor record based on role change
  if (user.role === Role.DOCTOR && existingUser.role !== Role.DOCTOR) {
    // Role changed to DOCTOR, create a doctor record if it doesn't exist
    const existingDoctor = await prisma.doctor.findUnique({ where: { userId: user.id } })
    if (!existingDoctor) {
      if (!clinicId) {
        throw new Error("Clinic is required to create doctor record")
      }
      const acronym = validatedData.acronym || generateAcronym(validatedData.firstName, validatedData.lastName, validatedData.secondLastName)
      await prisma.doctor.create({
        data: {
          userId: user.id,
          clinicId: clinicId,
          acronym: acronym,
          roomId: validatedData.roomId || null,
          isActive: true,
        },
      })
    } else {
      // Update existing doctor record
      const acronym = validatedData.acronym || existingDoctor.acronym
      await prisma.doctor.update({
        where: { userId: user.id },
        data: {
          clinicId: clinicId!,
          acronym: acronym,
          roomId: validatedData.roomId || null,
          isActive: validatedData.isActive,
        },
      })
    }
  } else if (user.role === Role.DOCTOR && existingUser.role === Role.DOCTOR) {
    // Still a doctor, update the doctor record
    const existingDoctor = await prisma.doctor.findUnique({ where: { userId: user.id } })
    if (existingDoctor) {
      const acronym = validatedData.acronym || existingDoctor.acronym
      await prisma.doctor.update({
        where: { userId: user.id },
        data: {
          clinicId: clinicId!,
          acronym: acronym,
          roomId: validatedData.roomId || null,
          isActive: validatedData.isActive,
        },
      })
    } else {
      // Doctor record doesn't exist, create it
      if (!clinicId) {
        throw new Error("Clinic is required to create doctor record")
      }
      const acronym = validatedData.acronym || generateAcronym(validatedData.firstName, validatedData.lastName, validatedData.secondLastName)
      await prisma.doctor.create({
        data: {
          userId: user.id,
          clinicId: clinicId,
          acronym: acronym,
          roomId: validatedData.roomId || null,
          isActive: validatedData.isActive,
        },
      })
    }
  } else if (user.role !== Role.DOCTOR && existingUser.role === Role.DOCTOR) {
    // Role changed from DOCTOR, delete the doctor record
    await prisma.doctor.delete({ where: { userId: user.id } }).catch(() => {
      // Ignore errors if doctor record doesn't exist for some reason
    })
  }

  revalidatePath("/users")
  revalidatePath("/doctors")
  return user
}

export async function deleteUser(id: string) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user || !Permissions.canManageUsers(session.user)) {
    throw new Error("Unauthorized")
  }

  const user = await prisma.user.findUnique({ where: { id } })
  
  await prisma.user.update({
    where: { id },
    data: { 
      isActive: false,
      deletedAt: new Date(),
    },
  })

  // If user is a doctor, also mark the doctor record as inactive
  if (user?.role === Role.DOCTOR) {
    await prisma.doctor.updateMany({
      where: { userId: id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    }).catch(() => {
      // Ignore if doctor record doesn't exist
    })
  }

  revalidatePath("/users")
  revalidatePath("/doctors")
}

export async function getUsers() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user || !Permissions.canManageUsers(session.user)) {
    throw new Error("Unauthorized")
  }

  const whereClause = session.user.role === Role.ADMIN 
    ? { isActive: true }
    : { 
        isActive: true,
        clinicId: session.user.clinicId 
      }

  return prisma.user.findMany({
    where: whereClause,
    include: {
      clinic: true,
    },
    orderBy: [
      { firstName: "asc" },
      { lastName: "asc" },
    ],
  })
}

export async function resetUserPassword(userId: string) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user || !Permissions.canManageUsers(session.user)) {
    throw new Error("Unauthorized")
  }

  // Get the target user
  const targetUser = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!targetUser) {
    throw new Error("User not found")
  }

  // Check if the current user can reset this user's password
  // ADMIN can reset any user's password except other ADMINs
  // CLINIC_ADMIN can reset passwords for users below their level in their clinic
  const canReset = 
    (session.user.role === Role.ADMIN && targetUser.role !== Role.ADMIN) ||
    (session.user.role === Role.CLINIC_ADMIN && 
     targetUser.role !== Role.ADMIN && 
     targetUser.role !== Role.CLINIC_ADMIN &&
     targetUser.clinicId === session.user.clinicId)

  if (!canReset) {
    throw new Error("Cannot reset password for this user")
  }

  // Generate temporary password
  const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`
  const hashedPassword = await bcrypt.hash(tempPassword, 12)

  await prisma.user.update({
    where: { id: userId },
    data: { 
      password: hashedPassword,
    },
  })

  revalidatePath("/users")
  
  return { 
    success: true, 
    tempPassword,
    email: targetUser.email 
  }
}
