"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Permissions } from "@/lib/permissions";

const createDoctorSchema = z.object({
  userId: z.string().min(1, "User is required"),
  clinicId: z.string().min(1, "Clinic is required"),
  roomId: z.string().optional(),
  acronym: z.string().min(1).max(5).default("D"),
});

const updateDoctorSchema = z.object({
  clinicId: z.string().min(1, "Clinic is required"),
  roomId: z.string().optional(),
  acronym: z.string().min(1).max(5).default("D"),
});

const createScheduleSchema = z.object({
  doctorId: z.string().min(1),
  weekday: z.number().min(0).max(6),
  startTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  endTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
});

export async function createDoctor(data: z.infer<typeof createDoctorSchema>) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageDoctors(session.user)) {
    throw new Error("Unauthorized");
  }

  const validatedData = createDoctorSchema.parse(data);

  if (!Permissions.canAccessClinic(session.user, validatedData.clinicId)) {
    throw new Error("Cannot create doctor in this clinic");
  }

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
}

export async function updateDoctor(
  id: string,
  data: z.infer<typeof updateDoctorSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageDoctors(session.user)) {
    throw new Error("Unauthorized");
  }

  const validatedData = updateDoctorSchema.parse(data);

  if (!Permissions.canAccessClinic(session.user, validatedData.clinicId)) {
    throw new Error("Cannot update doctor in this clinic");
  }

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
}

export async function deleteDoctor(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageDoctors(session.user)) {
    throw new Error("Unauthorized");
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
    throw new Error("Unauthorized");
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

  // Search filter
  if (search) {
    whereClause.user.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { licenseNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  // Specialty filter
  if (specialty !== "all") {
    whereClause.user.specialty = specialty;
  }

  // Get total count
  const total = await prisma.doctor.count({
    where: whereClause,
  });

  // Calculate pagination
  const totalPages = Math.ceil(total / pageSize);
  const skip = (page - 1) * pageSize;

  // Get doctors with pagination
  const doctors = await prisma.doctor.findMany({
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
    },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
    skip,
    take: pageSize,
  });

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
    throw new Error("Unauthorized");
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
    throw new Error("Doctor not found");
  }

  // Check access
  if (
    session.user.role !== "ADMIN" &&
    doctor.clinicId !== session.user.clinicId
  ) {
    throw new Error("Unauthorized to view this doctor");
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
    throw new Error("Unauthorized");
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
    throw new Error("Doctor record not found for current user");
  }

  // Ensure the session user can access this doctor (clinic match or admin)
  if (
    session.user.role !== "ADMIN" &&
    doctor.clinicId !== session.user.clinicId
  ) {
    throw new Error("Unauthorized to view this doctor");
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
    throw new Error("Unauthorized");
  }

  const whereClause: any = {
    deletedAt: null,
    user: {
      deletedAt: null,
      specialty: {
        not: null,
      },
    },
  };

  // Non-admin users only see doctors from their clinic
  if (session.user.role !== "ADMIN") {
    whereClause.clinicId = session.user.clinicId || "";
  }

  const doctors = await prisma.doctor.findMany({
    where: whereClause,
    select: {
      user: {
        select: {
          specialty: true,
        },
      },
    },
  });

  // Get unique specialties
  const specialties = Array.from(
    new Set(
      doctors
        .map((d) => d.user?.specialty)
        .filter((s): s is string => s !== null && s !== undefined)
    )
  ).sort();

  return specialties;
}
