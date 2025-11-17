"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Permissions } from "@/lib/permissions";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[a-z]/, "Debe contener al menos una letra minúscula")
    .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula")
    .regex(/[0-9]/, "Debe contener al menos un número")
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      "Debe contener al menos un carácter especial"
    ),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  secondLastName: z.string().optional(),
  noSecondLastName: z.boolean().optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(Role),
  clinicId: z.string().optional(),
  // Doctor-specific fields
  specialtyIds: z.array(z.string()).optional(), // Array de IDs de especialidades
  primarySpecialtyId: z.string().optional(), // ID de especialidad principal
  licenseNumber: z.string().optional(),
  acronym: z.string().optional(),
  roomId: z.string().optional(),
});

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
  specialtyIds: z.array(z.string()).optional(), // Array de IDs de especialidades
  primarySpecialtyId: z.string().optional(), // ID de especialidad principal
  licenseNumber: z.string().optional(),
  acronym: z.string().optional(),
  roomId: z.string().optional(),
});

export async function createUser(data: z.infer<typeof createUserSchema>) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageUsers(session.user)) {
    throw new Error("Unauthorized");
  }

  if (!Permissions.canCreateUser(session.user, data.role)) {
    throw new Error("Cannot create user with this role");
  }

  const validatedData = createUserSchema.parse(data);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: validatedData.email },
  });

  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(validatedData.password, 12);

  // Determine clinic ID
  let clinicId = validatedData.clinicId;
  if (session.user.role !== Role.ADMIN) {
    clinicId = session.user.clinicId || undefined;
  }

  // For doctors, clinicId is required
  if (validatedData.role === Role.DOCTOR && !clinicId) {
    throw new Error("Clinic is required for doctor role");
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
      licenseNumber: validatedData.licenseNumber || null,
    },
    include: {
      clinic: true,
    },
  });

  // If user is a doctor, create a corresponding doctor record
  if (user.role === Role.DOCTOR) {
    // Generate acronym if not provided: initials of name and last names
    let acronym = validatedData.acronym;
    if (!acronym) {
      const firstInitial = validatedData.firstName.charAt(0).toUpperCase();
      const lastInitial = validatedData.lastName.charAt(0).toUpperCase();
      const secondLastInitial = validatedData.secondLastName
        ? validatedData.secondLastName.charAt(0).toUpperCase()
        : "";
      acronym = `${firstInitial}${lastInitial}${secondLastInitial}`;
    }

    const doctor = await prisma.doctor.create({
      data: {
        userId: user.id,
        clinicId: clinicId!,
        acronym: acronym,
        roomId: validatedData.roomId || null,
        isActive: true,
      },
    });

    // Asignar especialidades al doctor
    if (validatedData.specialtyIds && validatedData.specialtyIds.length > 0) {
      const specialtyAssignments = validatedData.specialtyIds.map(
        (specialtyId, index) => ({
          doctorId: doctor.id,
          specialtyId: specialtyId,
          // Si hay primarySpecialtyId definido, usarlo; si no, la primera es la principal
          isPrimary: validatedData.primarySpecialtyId
            ? specialtyId === validatedData.primarySpecialtyId
            : index === 0,
        })
      );

      await prisma.doctorSpecialty.createMany({
        data: specialtyAssignments,
      });
    }
  }

  revalidatePath("/users");
  revalidatePath("/doctors");
  return user;
}

export async function updateUser(
  userId: string,
  data: z.infer<typeof updateUserSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageUsers(session.user)) {
    throw new Error("Unauthorized");
  }

  const validatedData = updateUserSchema.parse(data);

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new Error("User not found");
  }

  // Determine clinic ID
  let clinicId = validatedData.clinicId;
  if (session.user.role !== Role.ADMIN) {
    clinicId = session.user.clinicId || undefined;
  }

  // For doctors, clinicId is required
  if (validatedData.role === Role.DOCTOR && !clinicId) {
    throw new Error("Clinic is required for doctor role");
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
      licenseNumber: validatedData.licenseNumber || null,
    },
    include: {
      clinic: true,
    },
  });

  // Generate acronym if not provided: initials of name and last names
  const generateAcronym = (
    firstName: string,
    lastName: string,
    secondLastName?: string
  ) => {
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    const secondLastInitial = secondLastName
      ? secondLastName.charAt(0).toUpperCase()
      : "";
    return `${firstInitial}${lastInitial}${secondLastInitial}`;
  };

  // Handle Doctor record based on role change
  if (user.role === Role.DOCTOR && existingUser.role !== Role.DOCTOR) {
    // Role changed to DOCTOR, create a doctor record if it doesn't exist
    const existingDoctor = await prisma.doctor.findUnique({
      where: { userId: user.id },
    });
    if (!existingDoctor) {
      if (!clinicId) {
        throw new Error("Clinic is required to create doctor record");
      }
      const acronym =
        validatedData.acronym ||
        generateAcronym(
          validatedData.firstName,
          validatedData.lastName,
          validatedData.secondLastName
        );
      const doctor = await prisma.doctor.create({
        data: {
          userId: user.id,
          clinicId: clinicId,
          acronym: acronym,
          roomId: validatedData.roomId || null,
          isActive: true,
        },
      });

      // Asignar especialidades si se proporcionan
      if (validatedData.specialtyIds && validatedData.specialtyIds.length > 0) {
        const specialtyAssignments = validatedData.specialtyIds.map(
          (specialtyId, index) => ({
            doctorId: doctor.id,
            specialtyId: specialtyId,
            isPrimary: validatedData.primarySpecialtyId
              ? specialtyId === validatedData.primarySpecialtyId
              : index === 0,
          })
        );
        await prisma.doctorSpecialty.createMany({
          data: specialtyAssignments,
        });
      }
    } else {
      // Update existing doctor record
      const acronym = validatedData.acronym || existingDoctor.acronym;
      await prisma.doctor.update({
        where: { userId: user.id },
        data: {
          clinicId: clinicId!,
          acronym: acronym,
          roomId: validatedData.roomId || null,
          isActive: validatedData.isActive,
        },
      });

      // Actualizar especialidades
      if (validatedData.specialtyIds !== undefined) {
        // Eliminar especialidades existentes
        await prisma.doctorSpecialty.deleteMany({
          where: { doctorId: existingDoctor.id },
        });

        // Agregar nuevas especialidades
        if (validatedData.specialtyIds.length > 0) {
          const specialtyAssignments = validatedData.specialtyIds.map(
            (specialtyId, index) => ({
              doctorId: existingDoctor.id,
              specialtyId: specialtyId,
              isPrimary: validatedData.primarySpecialtyId
                ? specialtyId === validatedData.primarySpecialtyId
                : index === 0,
            })
          );
          await prisma.doctorSpecialty.createMany({
            data: specialtyAssignments,
          });
        }
      }
    }
  } else if (user.role === Role.DOCTOR && existingUser.role === Role.DOCTOR) {
    // Still a doctor, update the doctor record
    const existingDoctor = await prisma.doctor.findUnique({
      where: { userId: user.id },
    });
    if (existingDoctor) {
      const acronym = validatedData.acronym || existingDoctor.acronym;
      await prisma.doctor.update({
        where: { userId: user.id },
        data: {
          clinicId: clinicId!,
          acronym: acronym,
          roomId: validatedData.roomId || null,
          isActive: validatedData.isActive,
        },
      });

      // Actualizar especialidades si se proporcionan
      if (validatedData.specialtyIds !== undefined) {
        // Eliminar especialidades existentes
        await prisma.doctorSpecialty.deleteMany({
          where: { doctorId: existingDoctor.id },
        });

        // Agregar nuevas especialidades
        if (validatedData.specialtyIds.length > 0) {
          const specialtyAssignments = validatedData.specialtyIds.map(
            (specialtyId, index) => ({
              doctorId: existingDoctor.id,
              specialtyId: specialtyId,
              isPrimary: validatedData.primarySpecialtyId
                ? specialtyId === validatedData.primarySpecialtyId
                : index === 0,
            })
          );
          await prisma.doctorSpecialty.createMany({
            data: specialtyAssignments,
          });
        }
      }
    } else {
      // Doctor record doesn't exist, create it
      if (!clinicId) {
        throw new Error("Clinic is required to create doctor record");
      }
      const acronym =
        validatedData.acronym ||
        generateAcronym(
          validatedData.firstName,
          validatedData.lastName,
          validatedData.secondLastName
        );
      const doctor = await prisma.doctor.create({
        data: {
          userId: user.id,
          clinicId: clinicId,
          acronym: acronym,
          roomId: validatedData.roomId || null,
          isActive: validatedData.isActive,
        },
      });

      // Asignar especialidades si se proporcionan
      if (validatedData.specialtyIds && validatedData.specialtyIds.length > 0) {
        const specialtyAssignments = validatedData.specialtyIds.map(
          (specialtyId, index) => ({
            doctorId: doctor.id,
            specialtyId: specialtyId,
            isPrimary: validatedData.primarySpecialtyId
              ? specialtyId === validatedData.primarySpecialtyId
              : index === 0,
          })
        );
        await prisma.doctorSpecialty.createMany({
          data: specialtyAssignments,
        });
      }
    }
  } else if (user.role !== Role.DOCTOR && existingUser.role === Role.DOCTOR) {
    // Role changed from DOCTOR, delete the doctor record (cascade will delete specialties)
    await prisma.doctor.delete({ where: { userId: user.id } }).catch(() => {
      // Ignore errors if doctor record doesn't exist for some reason
    });
  }

  revalidatePath("/users");
  revalidatePath("/doctors");
  return user;
}

export async function deleteUser(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageUsers(session.user)) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({ where: { id } });

  await prisma.user.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  // If user is a doctor, also mark the doctor record as inactive
  if (user?.role === Role.DOCTOR) {
    await prisma.doctor
      .updateMany({
        where: { userId: id },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      })
      .catch(() => {
        // Ignore if doctor record doesn't exist
      });
  }

  revalidatePath("/users");
  revalidatePath("/doctors");
}

export async function getUsers(params?: {
  search?: string;
  role?: string;
  status?: string;
  clinicId?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageUsers(session.user)) {
    throw new Error("Unauthorized");
  }

  const {
    search = "",
    role = "all",
    status = "all",
    clinicId = "all",
    page = 1,
    pageSize = 20,
  } = params || {};

  // Build where clause
  const whereClause: any = {
    deletedAt: null,
  };

  // Status filter
  if (status === "active") {
    whereClause.isActive = true;
  } else if (status === "inactive") {
    whereClause.isActive = false;
  }

  // Clinic filter
  if (session.user.role === Role.ADMIN) {
    if (clinicId === "none") {
      whereClause.clinicId = null;
    } else if (clinicId !== "all") {
      whereClause.clinicId = clinicId;
    }
  } else {
    // Non-admin users only see users from their clinic
    whereClause.clinicId = session.user.clinicId;
  }

  // Role filter
  if (role !== "all") {
    whereClause.role = role;
  }

  // Search filter
  if (search) {
    whereClause.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  // Get total count
  const total = await prisma.user.count({
    where: whereClause,
  });

  // Calculate pagination
  const totalPages = Math.ceil(total / pageSize);
  const skip = (page - 1) * pageSize;

  // Get users with pagination
  const users = await prisma.user.findMany({
    where: whereClause,
    include: {
      clinic: true,
      doctor: {
        select: {
          acronym: true,
          roomId: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
    skip,
    take: pageSize,
  });

  return {
    users,
    total,
    totalPages,
    currentPage: page,
  };
}

export async function resetUserPassword(userId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageUsers(session.user)) {
    throw new Error("Unauthorized");
  }

  // Get the target user
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  // Check if the current user can reset this user's password
  // ADMIN can reset any user's password except other ADMINs
  // CLINIC_ADMIN can reset passwords for users below their level in their clinic
  const canReset =
    (session.user.role === Role.ADMIN && targetUser.role !== Role.ADMIN) ||
    (session.user.role === Role.CLINIC_ADMIN &&
      targetUser.role !== Role.ADMIN &&
      targetUser.role !== Role.CLINIC_ADMIN &&
      targetUser.clinicId === session.user.clinicId);

  if (!canReset) {
    throw new Error("Cannot reset password for this user");
  }

  // Generate temporary password that meets security requirements
  // Format: TempXxxxYyyy1! (uppercase, lowercase, number, special char, 8+ chars)
  const randomPart = Math.random().toString(36).slice(-4); // lowercase letters
  const randomNum = Math.floor(Math.random() * 90 + 10); // 2 digit number
  const tempPassword = `Temp${randomPart.charAt(0).toUpperCase()}${randomPart.slice(1)}${randomNum}!`;
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
    },
  });

  revalidatePath("/users");

  return {
    success: true,
    tempPassword,
    email: targetUser.email,
  };
}
