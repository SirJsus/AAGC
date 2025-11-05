"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Permissions } from "@/lib/permissions";

const createClinicScheduleSchema = z.object({
  clinicId: z.string().min(1, "Clinic is required"),
  weekday: z.number().min(0).max(6, "Weekday must be between 0 and 6"),
  startTime: z
    .string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  endTime: z
    .string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
});

// ============= Clinic Schedules =============

export async function createClinicSchedule(
  data: z.infer<typeof createClinicScheduleSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageClinics(session.user)) {
    throw new Error("Unauthorized");
  }

  const validatedData = createClinicScheduleSchema.parse(data);

  // Validate time range
  if (validatedData.startTime >= validatedData.endTime) {
    throw new Error("End time must be after start time");
  }

  // Check for overlapping schedules
  const clinic = await prisma.clinic.findUnique({
    where: { id: validatedData.clinicId },
    include: {
      schedules: {
        where: {
          weekday: validatedData.weekday,
          isActive: true,
        },
      },
    },
  });

  if (!clinic) {
    throw new Error("Clinic not found");
  }

  // Check for time conflicts
  for (const schedule of clinic.schedules) {
    const existingStart = schedule.startTime;
    const existingEnd = schedule.endTime;
    const newStart = validatedData.startTime;
    const newEnd = validatedData.endTime;

    // Check if times overlap
    if (
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    ) {
      throw new Error(
        `Schedule conflicts with existing schedule: ${existingStart} - ${existingEnd}`
      );
    }
  }

  const schedule = await prisma.clinicSchedule.create({
    data: validatedData,
  });

  revalidatePath("/clinics");
  return schedule;
}

export async function getClinicSchedules(clinicId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const schedules = await prisma.clinicSchedule.findMany({
    where: {
      clinicId,
      isActive: true,
    },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });

  return schedules;
}

export async function updateClinicSchedule(
  id: string,
  data: z.infer<typeof createClinicScheduleSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageClinics(session.user)) {
    throw new Error("Unauthorized");
  }

  const validatedData = createClinicScheduleSchema.parse(data);

  // Validate time range
  if (validatedData.startTime >= validatedData.endTime) {
    throw new Error("End time must be after start time");
  }

  // Check for overlapping schedules (excluding the current one)
  const clinic = await prisma.clinic.findUnique({
    where: { id: validatedData.clinicId },
    include: {
      schedules: {
        where: {
          weekday: validatedData.weekday,
          isActive: true,
          id: { not: id },
        },
      },
    },
  });

  if (!clinic) {
    throw new Error("Clinic not found");
  }

  // Check for time conflicts
  for (const schedule of clinic.schedules) {
    const existingStart = schedule.startTime;
    const existingEnd = schedule.endTime;
    const newStart = validatedData.startTime;
    const newEnd = validatedData.endTime;

    if (
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    ) {
      throw new Error(
        `Schedule conflicts with existing schedule: ${existingStart} - ${existingEnd}`
      );
    }
  }

  const schedule = await prisma.clinicSchedule.update({
    where: { id },
    data: validatedData,
  });

  revalidatePath("/clinics");
  return schedule;
}

export async function deleteClinicSchedule(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageClinics(session.user)) {
    throw new Error("Unauthorized");
  }

  await prisma.clinicSchedule.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  revalidatePath("/clinics");
}
