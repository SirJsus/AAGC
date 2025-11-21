"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Permissions } from "@/lib/permissions";

// Helper function to remove accents from strings
function removeAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

const createDoctorSchema = z.object({
  userId: z.string().min(1, "Por favor selecciona un usuario"),
  clinicId: z.string().min(1, "Por favor selecciona una clínica"),
  roomId: z.string().optional(),
  acronym: z
    .string()
    .min(1, "El acrónimo es requerido")
    .max(5, "El acrónimo debe tener máximo 5 caracteres")
    .default("D"),
});

const updateDoctorSchema = z.object({
  clinicId: z.string().min(1, "Por favor selecciona una clínica"),
  roomId: z.string().optional(),
  acronym: z
    .string()
    .min(1, "El acrónimo es requerido")
    .max(5, "El acrónimo debe tener máximo 5 caracteres")
    .default("D"),
});

const createScheduleSchema = z.object({
  doctorId: z.string().min(1, "Por favor selecciona un doctor"),
  weekday: z
    .number()
    .min(0, "El día debe estar entre 0 y 6")
    .max(6, "El día debe estar entre 0 y 6"),
  startTime: z
    .string()
    .regex(
      /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      "El formato de la hora de inicio no es válido. Usa formato HH:MM"
    ),
  endTime: z
    .string()
    .regex(
      /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      "El formato de la hora de finalización no es válido. Usa formato HH:MM"
    ),
});

export async function createDoctor(data: z.infer<typeof createDoctorSchema>) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageDoctors(session.user)) {
    throw new Error("No tienes permisos para crear doctores");
  }

  const validatedData = createDoctorSchema.parse(data);

  if (!Permissions.canAccessClinic(session.user, validatedData.clinicId)) {
    throw new Error("No tienes acceso a esta clínica para crear doctores");
  }

  // Validate user exists and is active
  const user = await prisma.user.findUnique({
    where: { id: validatedData.userId },
    select: { isActive: true, deletedAt: true, role: true },
  });

  if (!user || !user.isActive || user.deletedAt) {
    throw new Error(
      "El usuario seleccionado no está disponible o ha sido eliminado"
    );
  }

  if (user.role !== "DOCTOR") {
    throw new Error("El usuario seleccionado no tiene el rol de doctor");
  }

  // Check if user already has a doctor record
  const existingDoctor = await prisma.doctor.findUnique({
    where: { userId: validatedData.userId },
  });

  if (existingDoctor) {
    throw new Error("Este usuario ya tiene un registro de doctor asociado");
  }

  // Check for duplicate acronym in the same clinic
  const duplicateAcronym = await prisma.doctor.findFirst({
    where: {
      clinicId: validatedData.clinicId,
      acronym: validatedData.acronym,
      isActive: true,
      deletedAt: null,
    },
  });

  if (duplicateAcronym) {
    throw new Error(
      `El acrónimo "${validatedData.acronym}" ya está en uso por otro doctor en esta clínica`
    );
  }

  // Validate clinic exists and is active
  const clinic = await prisma.clinic.findUnique({
    where: { id: validatedData.clinicId },
    select: { isActive: true, deletedAt: true },
  });

  if (!clinic || !clinic.isActive || clinic.deletedAt) {
    throw new Error("La clínica seleccionada no está disponible");
  }

  // Validate room if provided
  if (validatedData.roomId) {
    const room = await prisma.room.findUnique({
      where: { id: validatedData.roomId },
      select: { isActive: true, deletedAt: true, clinicId: true },
    });

    if (!room || !room.isActive || room.deletedAt) {
      throw new Error("El consultorio seleccionado no está disponible");
    }

    if (room.clinicId !== validatedData.clinicId) {
      throw new Error(
        "El consultorio seleccionado no pertenece a la clínica indicada"
      );
    }
  }

  try {
    const doctor = await prisma.doctor.create({
      data: {
        ...validatedData,
        roomId: validatedData.roomId || null,
      },
      include: {
        clinic: true,
        user: true,
        defaultRoom: true,
      },
    });

    revalidatePath("/doctors");
    return doctor;
  } catch (error) {
    console.error("Error creating doctor:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      "No se pudo crear el registro de doctor. Por favor intenta nuevamente"
    );
  }
}

export async function updateDoctor(
  id: string,
  data: z.infer<typeof updateDoctorSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageDoctors(session.user)) {
    throw new Error("No tienes permisos para modificar doctores");
  }

  const validatedData = updateDoctorSchema.parse(data);

  if (!Permissions.canAccessClinic(session.user, validatedData.clinicId)) {
    throw new Error("No tienes acceso a esta clínica para modificar doctores");
  }

  // Validate doctor exists
  const existingDoctor = await prisma.doctor.findUnique({
    where: { id },
    select: { id: true, isActive: true, deletedAt: true },
  });

  if (!existingDoctor) {
    throw new Error("No se encontró el doctor solicitado");
  }

  if (!existingDoctor.isActive || existingDoctor.deletedAt) {
    throw new Error("No se puede modificar un doctor que ha sido dado de baja");
  }

  // Check for duplicate acronym in the same clinic (excluding current doctor)
  const duplicateAcronym = await prisma.doctor.findFirst({
    where: {
      clinicId: validatedData.clinicId,
      acronym: validatedData.acronym,
      isActive: true,
      deletedAt: null,
      id: { not: id },
    },
  });

  if (duplicateAcronym) {
    throw new Error(
      `El acrónimo "${validatedData.acronym}" ya está en uso por otro doctor en esta clínica`
    );
  }

  // Validate clinic exists and is active
  const clinic = await prisma.clinic.findUnique({
    where: { id: validatedData.clinicId },
    select: { isActive: true, deletedAt: true },
  });

  if (!clinic || !clinic.isActive || clinic.deletedAt) {
    throw new Error("La clínica seleccionada no está disponible");
  }

  // Validate room if provided
  if (validatedData.roomId) {
    const room = await prisma.room.findUnique({
      where: { id: validatedData.roomId },
      select: { isActive: true, deletedAt: true, clinicId: true },
    });

    if (!room || !room.isActive || room.deletedAt) {
      throw new Error("El consultorio seleccionado no está disponible");
    }

    if (room.clinicId !== validatedData.clinicId) {
      throw new Error(
        "El consultorio seleccionado no pertenece a la clínica indicada"
      );
    }
  }

  try {
    const doctor = await prisma.doctor.update({
      where: { id },
      data: {
        ...validatedData,
        roomId: validatedData.roomId || null,
      },
      include: {
        clinic: true,
        user: true,
        defaultRoom: true,
      },
    });

    revalidatePath("/doctors");
    return doctor;
  } catch (error) {
    console.error("Error updating doctor:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      "No se pudo actualizar el registro de doctor. Por favor intenta nuevamente"
    );
  }
}

export async function deleteDoctor(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageDoctors(session.user)) {
    throw new Error("No tienes permisos para eliminar doctores");
  }

  // Validate doctor exists
  const doctor = await prisma.doctor.findUnique({
    where: { id },
    select: { id: true, isActive: true, deletedAt: true },
  });

  if (!doctor) {
    throw new Error("No se encontró el doctor solicitado");
  }

  if (!doctor.isActive || doctor.deletedAt) {
    throw new Error("Este doctor ya ha sido dado de baja");
  }

  // Check for active appointments
  const activeAppointments = await prisma.appointment.count({
    where: {
      doctorId: id,
      isActive: true,
      date: {
        gte: new Date().toISOString().split("T")[0],
      },
    },
  });

  if (activeAppointments > 0) {
    throw new Error(
      `No se puede eliminar el doctor porque tiene ${activeAppointments} cita(s) activa(s) pendiente(s). Por favor cancela o reasigna las citas primero`
    );
  }

  await prisma.doctor.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  revalidatePath("/doctors");
}

export async function getDoctors(params?: {
  search?: string;
  status?: string;
  clinicId?: string;
  specialty?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("No tienes permisos para ver la lista de doctores");
  }

  const {
    search = "",
    status = "active",
    clinicId = "all",
    specialty = "all",
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

  // Clinic filter (only for ADMIN)
  if (session.user.role === "ADMIN") {
    if (clinicId !== "all") {
      whereClause.clinicId = clinicId;
    }
  } else {
    // Non-admin users only see doctors from their clinic
    whereClause.clinicId = session.user.clinicId || "";
  }

  // User filters
  whereClause.user = {
    deletedAt: null,
  };

  // Specialty filter
  if (specialty !== "all") {
    whereClause.specialties = {
      some: {
        specialtyId: specialty,
      },
    };
  }

  // Get all doctors matching base filters (without search initially)
  const allDoctors = await prisma.doctor.findMany({
    where: whereClause,
    include: {
      clinic: {
        include: {
          schedules: {
            where: {
              isActive: true,
              deletedAt: null,
            },
            orderBy: { weekday: "asc" },
          },
        },
      },
      user: true,
      defaultRoom: true,
      schedules: {
        where: {
          isActive: true,
          deletedAt: null,
        },
        orderBy: { weekday: "asc" },
      },
      specialties: {
        include: {
          specialty: true,
        },
        orderBy: {
          isPrimary: "desc", // Principal primero
        },
      },
    },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
  });

  // Apply flexible search filter if search term is provided
  let filteredDoctors = allDoctors;
  if (search) {
    // Normalize query: remove accents and convert to uppercase
    const normalizedQuery = removeAccents(search.trim());

    // Split query into words for flexible matching
    const queryWords = normalizedQuery
      .split(/\s+/)
      .filter((word) => word.length > 0);

    // Filter doctors by checking if all query words appear in searchable fields
    filteredDoctors = allDoctors.filter((doctor) => {
      const fullName = removeAccents(
        `${doctor.user.firstName} ${doctor.user.lastName} ${doctor.user.secondLastName || ""}`
      );
      const phone = removeAccents(doctor.user.phone || "");
      const email = removeAccents(doctor.user.email || "");
      const licenseNumber = removeAccents(doctor.user.licenseNumber || "");

      // Check if all query words appear somewhere in the searchable fields
      return queryWords.every((word) => {
        return (
          fullName.includes(word) ||
          phone.includes(word) ||
          email.includes(word) ||
          licenseNumber.includes(word)
        );
      });
    });
  }

  // Get total count after filtering
  const total = filteredDoctors.length;

  // Calculate pagination
  const totalPages = Math.ceil(total / pageSize);
  const skip = (page - 1) * pageSize;

  // Apply pagination
  const doctors = filteredDoctors.slice(skip, skip + pageSize);

  // Map schedules to include clinic schedules as fallback
  const doctorsWithSchedules = doctors.map((doctor) => {
    let schedules = doctor.schedules;

    // If doctor has no schedules, use clinic schedules
    if (schedules.length === 0 && doctor.clinic?.schedules) {
      schedules = doctor.clinic.schedules.map((clinicSchedule) => ({
        id: `clinic-${clinicSchedule.id}`,
        doctorId: doctor.id,
        weekday: clinicSchedule.weekday,
        startTime: clinicSchedule.startTime,
        endTime: clinicSchedule.endTime,
        isActive: clinicSchedule.isActive,
        createdAt: clinicSchedule.createdAt,
        updatedAt: clinicSchedule.updatedAt,
        deletedAt: clinicSchedule.deletedAt,
      }));
    }

    return {
      ...doctor,
      schedules,
    };
  });

  return {
    doctors: doctorsWithSchedules,
    total,
    totalPages,
    currentPage: page,
  };
}

export async function getDoctor(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("No tienes permisos para ver la información de doctores");
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: {
      clinic: {
        include: {
          schedules: {
            where: {
              isActive: true,
              deletedAt: null,
            },
            orderBy: { weekday: "asc" },
          },
        },
      },
      user: true,
      defaultRoom: true,
      schedules: {
        where: {
          isActive: true,
          deletedAt: null,
        },
        orderBy: { weekday: "asc" },
      },
    },
  });

  if (!doctor) {
    throw new Error(
      "No se encontró el doctor solicitado. Es posible que haya sido eliminado"
    );
  }

  // Check access
  if (
    session.user.role !== "ADMIN" &&
    doctor.clinicId !== session.user.clinicId
  ) {
    throw new Error(
      "No tienes permisos para ver la información de este doctor"
    );
  }

  // If doctor has no schedules, use clinic schedules as fallback
  let schedules = doctor.schedules;
  if (schedules.length === 0 && doctor.clinic?.schedules) {
    schedules = doctor.clinic.schedules.map((clinicSchedule) => ({
      id: `clinic-${clinicSchedule.id}`,
      doctorId: doctor.id,
      weekday: clinicSchedule.weekday,
      startTime: clinicSchedule.startTime,
      endTime: clinicSchedule.endTime,
      isActive: clinicSchedule.isActive,
      createdAt: clinicSchedule.createdAt,
      updatedAt: clinicSchedule.updatedAt,
      deletedAt: clinicSchedule.deletedAt,
    }));
  }

  return {
    ...doctor,
    schedules,
  };
}

export async function getDoctorByUserId() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("No tienes permisos para acceder a esta información");
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    include: {
      clinic: {
        include: {
          schedules: {
            where: {
              isActive: true,
              deletedAt: null,
            },
            orderBy: { weekday: "asc" },
          },
        },
      },
      user: true,
      defaultRoom: true,
      schedules: {
        where: { isActive: true, deletedAt: null },
        orderBy: { weekday: "asc" },
      },
    },
  });

  if (!doctor) {
    throw new Error(
      "No se encontró el registro de doctor para el usuario actual. Por favor contacta al administrador"
    );
  }

  // Ensure the session user can access this doctor (clinic match or admin)
  if (
    session.user.role !== "ADMIN" &&
    doctor.clinicId !== session.user.clinicId
  ) {
    throw new Error(
      "No tienes permisos para ver la información de este doctor"
    );
  }

  // If doctor has no schedules, use clinic schedules as fallback
  let schedules = doctor.schedules;
  if (schedules.length === 0 && doctor.clinic?.schedules) {
    schedules = doctor.clinic.schedules.map((clinicSchedule) => ({
      id: `clinic-${clinicSchedule.id}`,
      doctorId: doctor.id,
      weekday: clinicSchedule.weekday,
      startTime: clinicSchedule.startTime,
      endTime: clinicSchedule.endTime,
      isActive: clinicSchedule.isActive,
      createdAt: clinicSchedule.createdAt,
      updatedAt: clinicSchedule.updatedAt,
      deletedAt: clinicSchedule.deletedAt,
    }));
  }

  return {
    ...doctor,
    schedules,
  };
}

export async function getDoctorSpecialties() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("No tienes permisos para ver las especialidades");
  }

  // Obtener todas las especialidades únicas del sistema
  const specialties = await prisma.specialty.findMany({
    where: {
      isActive: true,
      deletedAt: null,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });

  return specialties;
}
