
"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { Permissions } from "@/lib/permissions"

const createAppointmentTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  clinicId: z.string().min(1, "Clinic is required"),
  durationMin: z.number().min(5).max(480).default(30),
  price: z.number().min(0).default(0),
  preInstructions: z.string().optional(),
})

export async function createAppointmentType(data: z.infer<typeof createAppointmentTypeSchema>) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user || !Permissions.canManageAppointmentTypes(session.user)) {
    throw new Error("Unauthorized")
  }

  const validatedData = createAppointmentTypeSchema.parse(data)

  if (!Permissions.canAccessClinic(session.user, validatedData.clinicId)) {
    throw new Error("Cannot create appointment type in this clinic")
  }

  const appointmentType = await prisma.appointmentType.create({
    data: validatedData,
    include: {
      clinic: true,
    },
  })

  revalidatePath("/appointment-types")
  
  // Convert Decimal to number for client component compatibility
  return {
    ...appointmentType,
    price: appointmentType.price.toNumber(),
  }
}

export async function updateAppointmentType(id: string, data: z.infer<typeof createAppointmentTypeSchema>) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user || !Permissions.canManageAppointmentTypes(session.user)) {
    throw new Error("Unauthorized")
  }

  const validatedData = createAppointmentTypeSchema.parse(data)

  if (!Permissions.canAccessClinic(session.user, validatedData.clinicId)) {
    throw new Error("Cannot update appointment type in this clinic")
  }

  const appointmentType = await prisma.appointmentType.update({
    where: { id },
    data: validatedData,
    include: {
      clinic: true,
    },
  })

  revalidatePath("/appointment-types")
  
  // Convert Decimal to number for client component compatibility
  return {
    ...appointmentType,
    price: appointmentType.price.toNumber(),
  }
}

export async function deleteAppointmentType(id: string) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user || !Permissions.canManageAppointmentTypes(session.user)) {
    throw new Error("Unauthorized")
  }

  await prisma.appointmentType.update({
    where: { id },
    data: { 
      isActive: false,
      deletedAt: new Date(),
    },
  })

  revalidatePath("/appointment-types")
}

export async function getAppointmentTypes() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  const whereClause = session.user.role === "ADMIN" 
    ? { isActive: true }
    : { 
        isActive: true,
        clinicId: session.user.clinicId || ""
      }

  const appointmentTypes = await prisma.appointmentType.findMany({
    where: whereClause,
    include: {
      clinic: true,
    },
    orderBy: [
      { clinic: { name: "asc" } },
      { name: "asc" },
    ],
  })

  // Convert Decimal to number for client component compatibility
  return appointmentTypes.map(type => ({
    ...type,
    price: type.price.toNumber(),
  }))
}
