"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";
import { Permissions } from "@/lib/permissions";

const createScheduleSchema = z.object({
  doctorId: z.string().min(1, "Doctor is required"),
  weekday: z.number().min(0).max(6, "Weekday must be between 0 and 6"),
  startTime: z
    .string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  endTime: z
    .string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
});

const createExceptionSchema = z.object({
  doctorId: z.string().min(1, "Doctor is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  startTime: z
    .string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)")
    .optional(),
  endTime: z
    .string()
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)")
    .optional(),
  reason: z.string().optional(),
});

// ============= Doctor Schedules =============

export async function createDoctorSchedule(
  data: z.infer<typeof createScheduleSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Allow admins/clinic admins, or the doctor owning the record
  const validatedData = createScheduleSchema.parse(data);
  let allowed = Permissions.canManageDoctors(session.user);
  if (!allowed) {
    if (session.user.role === "DOCTOR") {
      const doc = await prisma.doctor.findUnique({
        where: { id: validatedData.doctorId },
      });
      if (!doc || doc.userId !== session.user.id) {
        throw new Error("Unauthorized");
      }
      allowed = true;
    } else {
      throw new Error("Unauthorized");
    }
  }

  // validatedData already parsed above

  // Validate time range
  if (validatedData.startTime >= validatedData.endTime) {
    throw new Error("End time must be after start time");
  }

  // Check for overlapping schedules
  const doctor = await prisma.doctor.findUnique({
    where: { id: validatedData.doctorId },
    include: {
      schedules: {
        where: {
          weekday: validatedData.weekday,
          isActive: true,
        },
      },
    },
  });

  if (!doctor) {
    throw new Error("Doctor not found");
  }

  // Check for time conflicts
  for (const schedule of doctor.schedules) {
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

  const schedule = await prisma.doctorSchedule.create({
    data: validatedData,
  });

  revalidatePath("/doctors");
  return schedule;
}

export async function getDoctorSchedules(doctorId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  // Prevent doctors from fetching other doctors' schedules
  if (session.user.role === "DOCTOR") {
    const doc = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doc || doc.userId !== session.user.id) {
      throw new Error("Unauthorized");
    }
  }

  const schedules = await prisma.doctorSchedule.findMany({
    where: {
      doctorId,
      isActive: true,
    },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });

  // If doctor has specific schedules, return those
  if (schedules.length > 0) {
    return schedules;
  }

  // Otherwise, fallback to clinic schedules
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: {
      clinic: {
        include: {
          schedules: {
            where: { isActive: true },
            orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
          },
        },
      },
    },
  });

  if (!doctor?.clinic?.schedules) {
    return [];
  }

  // Map clinic schedules to look like doctor schedules for UI compatibility
  // Note: These won't have an ID that can be used to delete/edit
  return doctor.clinic.schedules.map((clinicSchedule) => ({
    id: `clinic-${clinicSchedule.id}`, // Prefix to indicate these are inherited
    doctorId,
    weekday: clinicSchedule.weekday,
    startTime: clinicSchedule.startTime,
    endTime: clinicSchedule.endTime,
    isActive: clinicSchedule.isActive,
    createdAt: clinicSchedule.createdAt,
    updatedAt: clinicSchedule.updatedAt,
    deletedAt: clinicSchedule.deletedAt,
  }));
}

export async function updateDoctorSchedule(
  id: string,
  data: z.infer<typeof createScheduleSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const validatedData = createScheduleSchema.parse(data);

  // Fetch existing schedule to know old weekday/start-end for impact analysis
  const existingSchedule = await prisma.doctorSchedule.findUnique({
    where: { id },
  });
  if (!existingSchedule) throw new Error("Schedule not found");

  // Allow admins/clinic admins, or doctor that owns the schedule
  let allowed = Permissions.canManageDoctors(session.user);
  if (!allowed) {
    if (session.user.role === "DOCTOR") {
      const doc = await prisma.doctor.findUnique({
        where: { id: existingSchedule.doctorId },
      });
      if (!doc || doc.userId !== session.user.id)
        throw new Error("Unauthorized");
      allowed = true;
    } else {
      throw new Error("Unauthorized");
    }
  }

  // Validate time range
  if (validatedData.startTime >= validatedData.endTime) {
    throw new Error("End time must be after start time");
  }

  const schedule = await prisma.doctorSchedule.update({
    where: { id },
    data: validatedData,
  });

  // After updating the schedule, mark affected appointments (future PENDING/CONFIRMED)
  try {
    // Determine which weekdays to check: old and new (if changed)
    const weekdaysToCheck = new Set<number>([
      existingSchedule.weekday,
      schedule.weekday,
    ]);

    // Fetch remaining schedules grouped by weekday
    const remainingSchedules = await prisma.doctorSchedule.findMany({
      where: { doctorId: schedule.doctorId, isActive: true },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    });

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Fetch future appointments for this doctor
    const futureAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: schedule.doctorId,
        date: { gte: todayStr },
        isActive: true,
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
      },
      include: { patient: true },
    });

    // Helper to check if appointment fits any schedule for a given weekday
    const fitsAnySchedule = (apt: any, weekday: number) => {
      const schedulesForWeek = remainingSchedules.filter(
        (s) => s.weekday === weekday
      );
      for (const s of schedulesForWeek) {
        if (apt.startTime >= s.startTime && apt.endTime <= s.endTime)
          return true;
      }
      return false;
    };

    const affected = futureAppointments.filter((apt) => {
      const aptWeekday = new Date(apt.date + "T00:00:00").getDay();
      if (!weekdaysToCheck.has(aptWeekday)) return false;
      // If it doesn't fit any remaining schedule for that weekday, it's affected
      return !fitsAnySchedule(apt, aptWeekday);
    });

    if (affected.length > 0) {
      const doc = await prisma.doctor.findUnique({
        where: { id: schedule.doctorId },
        include: { user: true },
      });
      await prisma.$transaction(async (tx) => {
        for (const apt of affected) {
          await tx.appointment.update({
            where: { id: apt.id },
            data: { status: AppointmentStatus.REQUIRES_RESCHEDULE },
          });

          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              clinicId: apt.clinicId,
              action: "UPDATE",
              entityType: "Appointment",
              entityId: apt.id,
              oldValues: { status: apt.status },
              newValues: { status: AppointmentStatus.REQUIRES_RESCHEDULE },
              metadata: {
                transitionType: "schedule_update",
                scheduleId: schedule.id,
                oldWeekday: existingSchedule.weekday,
                newWeekday: schedule.weekday,
                oldStart: existingSchedule.startTime,
                oldEnd: existingSchedule.endTime,
                newStart: schedule.startTime,
                newEnd: schedule.endTime,
                patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
                doctorName: doc
                  ? `${doc.user.firstName} ${doc.user.lastName}`
                  : null,
                appointmentTime: `${apt.startTime}-${apt.endTime}`,
                appointmentDate: apt.date,
              },
            },
          });
        }
      });
    }
  } catch (err) {
    console.error(
      "Error marking affected appointments after schedule update:",
      err
    );
  }

  revalidatePath("/doctors");
  return schedule;
}

export async function deleteDoctorSchedule(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Fetch schedule before deleting to know doctorId/weekday/start-end
  const scheduleBefore = await prisma.doctorSchedule.findUnique({
    where: { id },
  });
  if (!scheduleBefore) throw new Error("Schedule not found");

  // Allow admins/clinic admins, or doctor that owns the schedule
  let allowed = Permissions.canManageDoctors(session.user);
  if (!allowed) {
    if (session.user.role === "DOCTOR") {
      const doc = await prisma.doctor.findUnique({
        where: { id: scheduleBefore.doctorId },
      });
      if (!doc || doc.userId !== session.user.id)
        throw new Error("Unauthorized");
      allowed = true;
    } else {
      throw new Error("Unauthorized");
    }
  }

  await prisma.doctorSchedule.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  // After deletion, mark affected future appointments that no longer fit any schedule for that weekday
  try {
    const remainingSchedules = await prisma.doctorSchedule.findMany({
      where: {
        doctorId: scheduleBefore.doctorId,
        weekday: scheduleBefore.weekday,
        isActive: true,
      },
    });

    const todayStr = new Date().toISOString().slice(0, 10);

    const futureAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: scheduleBefore.doctorId,
        date: { gte: todayStr },
        isActive: true,
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
      },
      include: { patient: true },
    });

    const affected = futureAppointments.filter((apt) => {
      const aptWeekday = new Date(apt.date + "T00:00:00").getDay();
      if (aptWeekday !== scheduleBefore.weekday) return false;
      // If it doesn't fit any remaining schedule for that weekday, it's affected
      for (const s of remainingSchedules) {
        if (apt.startTime >= s.startTime && apt.endTime <= s.endTime)
          return false;
      }
      return true;
    });

    if (affected.length > 0) {
      const doc = await prisma.doctor.findUnique({
        where: { id: scheduleBefore.doctorId },
        include: { user: true },
      });
      await prisma.$transaction(async (tx) => {
        for (const apt of affected) {
          await tx.appointment.update({
            where: { id: apt.id },
            data: { status: AppointmentStatus.REQUIRES_RESCHEDULE },
          });
          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              clinicId: apt.clinicId,
              action: "UPDATE",
              entityType: "Appointment",
              entityId: apt.id,
              oldValues: { status: apt.status },
              newValues: { status: AppointmentStatus.REQUIRES_RESCHEDULE },
              metadata: {
                transitionType: "schedule_delete",
                scheduleId: scheduleBefore.id,
                scheduleWeekday: scheduleBefore.weekday,
                scheduleStart: scheduleBefore.startTime,
                scheduleEnd: scheduleBefore.endTime,
                patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
                doctorName: doc
                  ? `${doc.user.firstName} ${doc.user.lastName}`
                  : null,
                appointmentTime: `${apt.startTime}-${apt.endTime}`,
                appointmentDate: apt.date,
              },
            },
          });
        }
      });
    }
  } catch (err) {
    console.error(
      "Error marking affected appointments after schedule deletion:",
      err
    );
  }

  revalidatePath("/doctors");
}

// ============= Doctor Exceptions =============

export async function createDoctorException(
  data: z.infer<typeof createExceptionSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const validatedData = createExceptionSchema.parse(data);

  // Allow admins/clinic admins/reception, or the doctor owning the record
  let allowed = Permissions.canManageDoctorSchedules(session.user);
  if (!allowed) {
    if (session.user.role === "DOCTOR") {
      const doc = await prisma.doctor.findUnique({
        where: { id: validatedData.doctorId },
      });
      if (!doc || doc.userId !== session.user.id)
        throw new Error("Unauthorized");
      allowed = true;
    } else {
      throw new Error("Unauthorized");
    }
  }

  // If both times provided, validate range
  if (validatedData.startTime && validatedData.endTime) {
    if (validatedData.startTime >= validatedData.endTime) {
      throw new Error("End time must be after start time");
    }
  }

  const exception = await prisma.doctorException.create({
    data: {
      ...validatedData,
      startTime: validatedData.startTime || null,
      endTime: validatedData.endTime || null,
      reason: validatedData.reason || null,
    },
  });

  // After creating the exception, mark overlapping appointments (PENDING/CONFIRMED)
  try {
    const exceptionDate = new Date(validatedData.date + "T00:00:00");
    const nextDay = new Date(exceptionDate);
    nextDay.setDate(exceptionDate.getDate() + 1);

    const where: any = {
      doctorId: validatedData.doctorId,
      date: {
        gte: exceptionDate,
        lt: nextDay,
      },
      isActive: true,
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
    };

    // If this is a partial-day exception, only affect overlapping appointments
    if (validatedData.startTime && validatedData.endTime) {
      // exclude appointments that end on or before startTime or start on or after endTime
      where.NOT = [
        { endTime: { lte: validatedData.startTime } },
        { startTime: { gte: validatedData.endTime } },
      ];
    }

    const affectedAppointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        doctor: { include: { user: true } },
      },
    });

    if (affectedAppointments.length > 0) {
      // Update appointments and insert audit logs in a transaction
      await prisma.$transaction(async (tx) => {
        for (const apt of affectedAppointments) {
          await tx.appointment.update({
            where: { id: apt.id },
            data: { status: AppointmentStatus.REQUIRES_RESCHEDULE },
          });

          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              clinicId: apt.clinicId,
              action: "UPDATE",
              entityType: "Appointment",
              entityId: apt.id,
              oldValues: { status: apt.status },
              newValues: { status: AppointmentStatus.REQUIRES_RESCHEDULE },
              metadata: {
                transitionType: "exception",
                exceptionDate: validatedData.date,
                exceptionStart: validatedData.startTime || null,
                exceptionEnd: validatedData.endTime || null,
                reason: validatedData.reason || null,
                patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
                doctorName: `${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`,
                appointmentTime: `${apt.startTime}-${apt.endTime}`,
              },
            },
          });
        }
      });
    }
  } catch (err) {
    // non-fatal: log but don't block exception creation
    console.error("Error marking affected appointments:", err);
  }

  revalidatePath("/doctors");
  revalidatePath("/appointments");
  return exception;
}

export async function getDoctorExceptions(doctorId: string, fromDate?: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  // Prevent doctors from fetching other doctors' exceptions
  if (session.user.role === "DOCTOR") {
    const doc = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doc || doc.userId !== session.user.id) {
      throw new Error("Unauthorized");
    }
  }

  const where: any = {
    doctorId,
    isActive: true,
  };

  if (fromDate) {
    where.date = {
      gte: fromDate,
    };
  }

  const exceptions = await prisma.doctorException.findMany({
    where,
    orderBy: {
      date: "asc",
    },
  });

  return exceptions;
}

export async function updateDoctorException(
  id: string,
  data: z.infer<typeof createExceptionSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const validatedData = createExceptionSchema.parse(data);

  // Allow admins/clinic admins/reception, or the doctor owning the record
  let allowed = Permissions.canManageDoctorSchedules(session.user);
  if (!allowed) {
    if (session.user.role === "DOCTOR") {
      const exception = await prisma.doctorException.findUnique({
        where: { id },
      });
      if (!exception) throw new Error("Exception not found");
      const doc = await prisma.doctor.findUnique({
        where: { id: exception.doctorId },
      });
      if (!doc || doc.userId !== session.user.id)
        throw new Error("Unauthorized");
      allowed = true;
    } else {
      throw new Error("Unauthorized");
    }
  }

  // If both times provided, validate range
  if (validatedData.startTime && validatedData.endTime) {
    if (validatedData.startTime >= validatedData.endTime) {
      throw new Error("End time must be after start time");
    }
  }

  const exception = await prisma.doctorException.update({
    where: { id },
    data: {
      ...validatedData,
      startTime: validatedData.startTime || null,
      endTime: validatedData.endTime || null,
      reason: validatedData.reason || null,
    },
  });

  // After updating the exception, mark overlapping appointments (PENDING/CONFIRMED)
  try {
    const exceptionDate = new Date(validatedData.date + "T00:00:00");
    const nextDay = new Date(exceptionDate);
    nextDay.setDate(exceptionDate.getDate() + 1);

    const where: any = {
      doctorId: validatedData.doctorId,
      date: {
        gte: exceptionDate,
        lt: nextDay,
      },
      isActive: true,
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
    };

    if (validatedData.startTime && validatedData.endTime) {
      where.NOT = [
        { endTime: { lte: validatedData.startTime } },
        { startTime: { gte: validatedData.endTime } },
      ];
    }

    const affectedAppointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        doctor: { include: { user: true } },
      },
    });

    if (affectedAppointments.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const apt of affectedAppointments) {
          await tx.appointment.update({
            where: { id: apt.id },
            data: { status: AppointmentStatus.REQUIRES_RESCHEDULE },
          });

          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              clinicId: apt.clinicId,
              action: "UPDATE",
              entityType: "Appointment",
              entityId: apt.id,
              oldValues: { status: apt.status },
              newValues: { status: AppointmentStatus.REQUIRES_RESCHEDULE },
              metadata: {
                transitionType: "exception_update",
                exceptionId: id,
                exceptionDate: validatedData.date,
                exceptionStart: validatedData.startTime || null,
                exceptionEnd: validatedData.endTime || null,
                reason: validatedData.reason || null,
                patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
                doctorName: `${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`,
                appointmentTime: `${apt.startTime}-${apt.endTime}`,
              },
            },
          });
        }
      });
    }
  } catch (err) {
    console.error(
      "Error marking affected appointments after exception update:",
      err
    );
  }

  revalidatePath("/doctors");
  revalidatePath("/appointments");
  return exception;
}

export async function deleteDoctorException(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Allow admins/clinic admins/reception, or the doctor owning the record
  let allowed = Permissions.canManageDoctorSchedules(session.user);
  if (!allowed) {
    if (session.user.role === "DOCTOR") {
      const exception = await prisma.doctorException.findUnique({
        where: { id },
      });
      if (!exception) throw new Error("Exception not found");
      const doc = await prisma.doctor.findUnique({
        where: { id: exception.doctorId },
      });
      if (!doc || doc.userId !== session.user.id)
        throw new Error("Unauthorized");
      allowed = true;
    } else {
      throw new Error("Unauthorized");
    }
  }

  await prisma.doctorException.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  revalidatePath("/doctors");
}

// Helper function to check if a doctor is available at a specific time
export async function isDoctorAvailable(
  doctorId: string,
  date: string, // YYYY-MM-DD
  startTime: string, // HH:MM
  endTime: string // HH:MM
): Promise<boolean> {
  const dateObj = new Date(date);
  const weekday = dateObj.getDay();

  // Check if there's an exception for this date
  const exception = await prisma.doctorException.findFirst({
    where: {
      doctorId,
      date,
      isActive: true,
    },
  });

  // If full day exception, not available
  if (exception && !exception.startTime && !exception.endTime) {
    return false;
  }

  // If partial exception, check if it conflicts
  if (exception && exception.startTime && exception.endTime) {
    const exStart = exception.startTime;
    const exEnd = exception.endTime;

    if (
      (startTime >= exStart && startTime < exEnd) ||
      (endTime > exStart && endTime <= exEnd) ||
      (startTime <= exStart && endTime >= exEnd)
    ) {
      return false;
    }
  }

  // Check regular schedule for this weekday
  const schedules = await prisma.doctorSchedule.findMany({
    where: {
      doctorId,
      weekday,
      isActive: true,
    },
  });

  // Check if the requested time falls within any schedule block
  for (const schedule of schedules) {
    if (startTime >= schedule.startTime && endTime <= schedule.endTime) {
      return true;
    }
  }

  return false;
}
