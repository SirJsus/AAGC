"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Permissions } from "@/lib/permissions";
import { AppointmentStatus, PaymentMethod } from "@prisma/client";
import { isValidStateTransition } from "@/lib/utils/appointment-state";
import { extractDateInClinicTimezone } from "@/lib/utils/timezone";

const createAppointmentSchema = z.object({
  patientId: z.string().min(1, "Por favor selecciona un paciente"),
  doctorId: z.string().min(1, "Por favor selecciona un doctor"),
  roomId: z.string().optional(),
  appointmentTypeId: z.string().optional(),
  customReason: z.string().optional(),
  customPrice: z
    .number()
    .min(0, "El precio debe ser mayor o igual a cero")
    .optional(),
  durationMin: z
    .number()
    .min(5, "La duración debe ser al menos 5 minutos")
    .max(480, "La duración no puede ser mayor a 8 horas")
    .optional(),
  date: z.union([z.string(), z.date()]).transform((val) => {
    // Convert string to Date if needed, otherwise use Date directly
    if (typeof val === "string") {
      return new Date(val);
    }
    return val;
  }),
  startTime: z.string().min(1, "Por favor ingresa la hora de inicio"),
  endTime: z.string().min(1, "Por favor ingresa la hora de finalización"),
  notes: z.string().optional(),
});

export async function createAppointment(
  data: z.infer<typeof createAppointmentSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canCreateAppointments(session.user)) {
    throw new Error("No tienes permisos para crear citas");
  }

  const validatedData = createAppointmentSchema.parse(data);

  // Validate that end time is after start time
  if (validatedData.startTime >= validatedData.endTime) {
    throw new Error(
      "La hora de finalización debe ser posterior a la hora de inicio"
    );
  }

  // Validate date is not in the past (except for ADMIN and CLINIC_ADMIN)
  const appointmentDate = new Date(validatedData.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (appointmentDate < today) {
    // Only ADMIN and CLINIC_ADMIN can create appointments in past dates
    if (session.user.role !== "ADMIN" && session.user.role !== "CLINIC_ADMIN") {
      throw new Error("No se pueden crear citas en fechas pasadas");
    }
  }

  // Get clinic ID for appointment
  let clinicId = session.user.clinicId;
  if (session.user.role === "ADMIN" && !clinicId) {
    // For ADMIN users, get clinic from doctor
    const doctor = await prisma.doctor.findUnique({
      where: { id: validatedData.doctorId },
    });
    if (!doctor) {
      throw new Error(
        "No se encontró el doctor seleccionado. Por favor, verifica que el doctor exista"
      );
    }
    clinicId = doctor.clinicId;
  }

  if (!clinicId) {
    throw new Error(
      "No se pudo determinar la clínica para esta cita. Por favor contacta al administrador"
    );
  }

  // Validate patient exists and is active
  const patient = await prisma.patient.findUnique({
    where: { id: validatedData.patientId },
    select: { isActive: true, deletedAt: true },
  });

  if (!patient || !patient.isActive || patient.deletedAt) {
    throw new Error(
      "El paciente seleccionado no está disponible o ha sido eliminado"
    );
  }

  // Validate doctor exists and is active
  const doctor = await prisma.doctor.findUnique({
    where: { id: validatedData.doctorId },
    select: { isActive: true, deletedAt: true, clinicId: true },
  });

  if (!doctor || !doctor.isActive || doctor.deletedAt) {
    throw new Error(
      "El doctor seleccionado no está disponible o ha sido dado de baja"
    );
  }

  // Validate room if provided
  if (validatedData.roomId) {
    const room = await prisma.room.findUnique({
      where: { id: validatedData.roomId },
      select: { isActive: true, deletedAt: true },
    });

    if (!room || !room.isActive || room.deletedAt) {
      throw new Error("El consultorio seleccionado no está disponible");
    }
  }

  // Check for conflicts
  const conflicts = await checkAppointmentConflicts({
    doctorId: validatedData.doctorId,
    patientId: validatedData.patientId,
    roomId: validatedData.roomId,
    date: validatedData.date,
    startTime: validatedData.startTime,
    endTime: validatedData.endTime,
    excludeAppointmentId: undefined,
  });

  if (conflicts.length > 0) {
    throw new Error(`No se puede agendar la cita: ${conflicts.join(". ")}`);
  }

  try {
    const appointment = await prisma.appointment.create({
      data: {
        ...validatedData,
        clinicId,
        roomId: validatedData.roomId || null,
        appointmentTypeId: validatedData.appointmentTypeId || null,
        customReason: validatedData.customReason || null,
        // Ensure appointment stores a single effective price: prefer an explicit
        // customPrice provided by the caller; otherwise, if an appointmentType
        // was selected, use its price as the appointment's customPrice so the
        // appointment always contains the effective price.
        customPrice:
          typeof validatedData.customPrice !== "undefined"
            ? validatedData.customPrice
            : // if appointmentTypeId provided, fetch its price
              validatedData.appointmentTypeId
              ? ((
                  await prisma.appointmentType.findUnique({
                    where: { id: validatedData.appointmentTypeId },
                    select: { price: true },
                  })
                )?.price ?? null)
              : null,
        // Store custom duration if provided; otherwise, if an appointmentType
        // was selected, use its duration as the appointment's durationMin so the
        // appointment always contains the effective duration.
        durationMin:
          typeof validatedData.durationMin !== "undefined"
            ? validatedData.durationMin
            : // if appointmentTypeId provided, fetch its duration
              validatedData.appointmentTypeId
              ? ((
                  await prisma.appointmentType.findUnique({
                    where: { id: validatedData.appointmentTypeId },
                    select: { durationMin: true },
                  })
                )?.durationMin ?? null)
              : null,
        status: AppointmentStatus.PENDING,
      },
      include: {
        patient: true,
        doctor: {
          include: { user: true },
        },
        clinic: true,
        room: true,
        appointmentType: true,
      },
    });

    revalidatePath("/appointments");

    // Convert Decimal fields to numbers for client component compatibility
    return {
      ...appointment,
      customPrice: appointment.customPrice?.toNumber() ?? null,
      appointmentType: appointment.appointmentType
        ? {
            ...appointment.appointmentType,
            price: appointment.appointmentType.price.toNumber(),
          }
        : null,
    };
  } catch (error) {
    console.error("Error creating appointment:", error);
    if (error instanceof Error) {
      throw error; // Re-throw if it's already a handled error
    }
    throw new Error(
      "No se pudo crear la cita. Por favor intenta nuevamente o contacta al administrador"
    );
  }
}

export async function updateAppointment(
  id: string,
  data: z.infer<typeof createAppointmentSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageAppointments(session.user)) {
    throw new Error("No tienes permisos para modificar citas");
  }

  const validatedData = createAppointmentSchema.parse(data);

  // Validate that end time is after start time
  if (validatedData.startTime >= validatedData.endTime) {
    throw new Error(
      "La hora de finalización debe ser posterior a la hora de inicio"
    );
  }

  // Get current appointment to check if it's in REQUIRES_RESCHEDULE status
  const currentAppointment = await prisma.appointment.findUnique({
    where: { id },
  });

  if (!currentAppointment) {
    throw new Error(
      "No se encontró la cita solicitada. Es posible que haya sido eliminada"
    );
  }

  // Check for conflicts (excluding current appointment)
  const conflicts = await checkAppointmentConflicts({
    doctorId: validatedData.doctorId,
    patientId: validatedData.patientId,
    roomId: validatedData.roomId,
    date: validatedData.date,
    startTime: validatedData.startTime,
    endTime: validatedData.endTime,
    excludeAppointmentId: id,
  });

  if (conflicts.length > 0) {
    throw new Error(`No se puede actualizar la cita: ${conflicts.join(". ")}`);
  }

  // If the appointment is in REQUIRES_RESCHEDULE status and date/time is being changed,
  // automatically transition to PENDING
  const isRescheduling =
    currentAppointment.status === AppointmentStatus.REQUIRES_RESCHEDULE &&
    (currentAppointment.date !== validatedData.date ||
      currentAppointment.startTime !== validatedData.startTime ||
      currentAppointment.endTime !== validatedData.endTime ||
      currentAppointment.doctorId !== validatedData.doctorId);

  try {
    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        ...validatedData,
        roomId: validatedData.roomId || null,
        appointmentTypeId: validatedData.appointmentTypeId || null,
        customReason: validatedData.customReason || null,
        // Ensure the appointment's stored customPrice reflects the effective
        // price after updating: prefer an explicit provided customPrice; if
        // absent and an appointmentTypeId is provided, use that appointment
        // type's price so the appointment keeps a single authoritative price.
        customPrice:
          typeof validatedData.customPrice !== "undefined"
            ? validatedData.customPrice
            : validatedData.appointmentTypeId
              ? ((
                  await prisma.appointmentType.findUnique({
                    where: { id: validatedData.appointmentTypeId },
                    select: { price: true },
                  })
                )?.price ?? null)
              : null,
        status: isRescheduling
          ? AppointmentStatus.PENDING
          : currentAppointment.status,
      },
      include: {
        patient: true,
        doctor: {
          include: { user: true },
        },
        clinic: true,
        room: true,
        appointmentType: true,
      },
    });

    revalidatePath("/appointments");

    // Convert Decimal fields to numbers for client component compatibility
    return {
      ...appointment,
      customPrice: appointment.customPrice?.toNumber() ?? null,
      appointmentType: appointment.appointmentType
        ? {
            ...appointment.appointmentType,
            price: appointment.appointmentType.price.toNumber(),
          }
        : null,
    };
  } catch (error) {
    console.error("Error updating appointment:", error);
    if (error instanceof Error) {
      throw error; // Re-throw if it's already a handled error
    }
    throw new Error(
      "No se pudo actualizar la cita. Por favor intenta nuevamente o contacta al administrador"
    );
  }
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  cancelReason?: string,
  notes?: string,
  paymentMethod?: PaymentMethod,
  paymentConfirmed?: boolean,
  paymentAmount?: number
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageAppointments(session.user)) {
    throw new Error("No tienes permisos para cambiar el estado de las citas");
  }

  // Get current appointment to validate state transition
  const currentAppointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: {
        include: { user: true },
      },
    },
  });

  if (!currentAppointment) {
    throw new Error(
      "No se encontró la cita solicitada. Es posible que haya sido eliminada"
    );
  }

  // Validate state transition
  // If user is attempting to set PAID with a transfer that is not yet confirmed,
  // convert to the intermediate TRANSFER_PENDING state instead.
  let targetStatus = status;
  if (
    status === AppointmentStatus.PAID &&
    paymentMethod === PaymentMethod.TRANSFER &&
    paymentConfirmed !== true
  ) {
    targetStatus = AppointmentStatus.TRANSFER_PENDING;
  }

  // Validate payment amount (if provided)
  if (
    typeof paymentAmount !== "undefined" &&
    (typeof paymentAmount !== "number" ||
      !isFinite(paymentAmount) ||
      paymentAmount < 0)
  ) {
    throw new Error(
      "El monto del pago no es válido. Debe ser un número mayor o igual a cero"
    );
  }

  // Validate state transition to the (possibly adjusted) target status
  if (!isValidStateTransition(currentAppointment.status, targetStatus)) {
    throw new Error(
      `No se puede cambiar el estado de la cita de "${currentAppointment.status}" a "${targetStatus}". Esta transición no está permitida`
    );
  }

  // Check if patient has complete mandatory data when moving to IN_CONSULTATION
  if (
    status === AppointmentStatus.IN_CONSULTATION &&
    currentAppointment.status === AppointmentStatus.CONFIRMED
  ) {
    const patient = currentAppointment.patient;
    const hasCompleteData = !!(
      patient.firstName &&
      patient.lastName &&
      (patient.secondLastName || patient.noSecondLastName) &&
      patient.phone &&
      patient.birthDate &&
      patient.gender
    );

    if (!hasCompleteData) {
      throw new Error(
        "El paciente no tiene los datos obligatorios completos. Por favor, complete la información del paciente antes de iniciar la consulta."
      );
    }
  }

  // Require cancel reason when cancelling
  if (status === AppointmentStatus.CANCELLED && !cancelReason) {
    throw new Error("Por favor ingresa el motivo de la cancelación de la cita");
  }

  // Update appointment within a transaction to include audit log
  let appointment;
  try {
    appointment = await prisma.$transaction(async (tx) => {
      // Update appointment
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          status: targetStatus,
          notes: notes || undefined,
          cancelReason:
            status === AppointmentStatus.CANCELLED ? cancelReason : undefined,
          cancelledAt:
            status === AppointmentStatus.CANCELLED ? new Date() : undefined,
          cancelledBy:
            status === AppointmentStatus.CANCELLED
              ? session.user.id
              : undefined,
          // If provided, persist payment info when status is updated to PAID (or any provided value)
          paymentMethod: paymentMethod || undefined,
          paymentConfirmed:
            typeof paymentConfirmed === "boolean"
              ? paymentConfirmed
              : undefined,
          // Allow optionally overriding/storing a payment amount when changing status to PAID
          customPrice:
            typeof paymentAmount === "number" ? paymentAmount : undefined,
        },
        include: {
          patient: true,
          doctor: {
            include: { user: true },
          },
          clinic: true,
          room: true,
          appointmentType: true,
        },
      });

      // Create audit log for state transition
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          clinicId: updated.clinicId,
          action: "UPDATE",
          entityType: "Appointment",
          entityId: id,
          oldValues: {
            status: currentAppointment.status,
            notes: currentAppointment.notes,
            cancelReason: currentAppointment.cancelReason,
            paymentMethod: currentAppointment.paymentMethod,
            paymentConfirmed: currentAppointment.paymentConfirmed,
            customPrice: currentAppointment.customPrice,
          },
          newValues: {
            status: updated.status,
            notes: updated.notes,
            cancelReason: updated.cancelReason,
            paymentMethod: updated.paymentMethod,
            paymentConfirmed: updated.paymentConfirmed,
            customPrice: updated.customPrice,
          },
          metadata: {
            transitionType: "statusChange",
            from: currentAppointment.status,
            to: targetStatus,
            requestedStatus: status,
            patientName: `${currentAppointment.patient.firstName} ${currentAppointment.patient.lastName}`,
            doctorName: `${currentAppointment.doctor.user.firstName} ${
              currentAppointment.doctor.user.lastName
            } ${currentAppointment.doctor.user.secondLastName || ""}`.trim(),
            appointmentDate: currentAppointment.date,
            appointmentTime: currentAppointment.startTime,
            paymentMethod: paymentMethod || null,
            paymentConfirmed:
              typeof paymentConfirmed === "boolean" ? paymentConfirmed : null,
          },
        },
      });

      return updated;
    });
  } catch (error) {
    console.error("Error updating appointment status:", error);
    throw new Error(
      "No se pudo actualizar el estado de la cita. Por favor intenta nuevamente"
    );
  }

  revalidatePath("/appointments");

  // Convert Decimal to number
  return {
    ...appointment,
    customPrice: appointment.customPrice
      ? appointment.customPrice.toNumber()
      : null,
    appointmentType: appointment.appointmentType
      ? {
          ...appointment.appointmentType,
          price: appointment.appointmentType.price.toNumber(),
        }
      : null,
  };
}

export async function deleteAppointment(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageAppointments(session.user)) {
    throw new Error("No tienes permisos para eliminar citas");
  }

  // Verify appointment exists before deletion
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, status: true, isActive: true },
  });

  if (!appointment) {
    throw new Error("No se encontró la cita solicitada");
  }

  if (!appointment.isActive) {
    throw new Error("Esta cita ya ha sido eliminada");
  }

  await prisma.appointment.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  revalidatePath("/appointments");
}

export async function hardDeleteAppointment(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canDeleteAppointments(session.user)) {
    throw new Error("No tienes permisos para eliminar permanentemente citas");
  }

  // Verify appointment exists before deletion
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, clinicId: true },
  });

  if (!appointment) {
    throw new Error("No se encontró la cita solicitada");
  }

  // If user is CLINIC_ADMIN, verify they have access to this clinic
  if (session.user.role === "CLINIC_ADMIN") {
    if (!Permissions.canAccessClinic(session.user, appointment.clinicId)) {
      throw new Error("No tienes permisos para eliminar esta cita");
    }
  }

  // Permanently delete from database
  await prisma.appointment.delete({
    where: { id },
  });

  revalidatePath("/appointments");
}

export async function getAppointments(
  date?: string,
  doctorId?: string,
  patientId?: string,
  clinicId?: string
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewAppointments(session.user)) {
    throw new Error("No tienes permisos para ver las citas");
  }

  const whereClause: any = {
    isActive: true,
  };

  if (session.user.role === "DOCTOR") {
    // Buscar el doctorId usando el id de usuario actual
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (doctor) {
      whereClause.doctorId = doctor.id;
    } else {
      throw new Error(
        "No se encontró el registro de doctor para este usuario."
      );
    }
  } else if (session.user.role !== "ADMIN") {
    whereClause.clinicId = session.user.clinicId;
  }

  // Clinic filter (only for ADMIN)
  if (session.user.role === "ADMIN" && clinicId && clinicId !== "all") {
    whereClause.clinicId = clinicId;
  }

  if (date) {
    whereClause.date = date;
  }

  if (doctorId) {
    whereClause.doctorId = doctorId;
  }

  if (patientId) {
    whereClause.patientId = patientId;
  }

  const appointments = await prisma.appointment.findMany({
    where: whereClause,
    include: {
      patient: true,
      doctor: {
        include: { user: true },
      },
      clinic: true,
      room: true,
      appointmentType: true,
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 200, // Limit for performance
  });

  // Convert Decimal fields to numbers for client component compatibility
  return appointments.map((appointment) => ({
    ...appointment,
    customPrice: appointment.customPrice
      ? appointment.customPrice.toNumber()
      : null,
    appointmentType: appointment.appointmentType
      ? {
          ...appointment.appointmentType,
          price: appointment.appointmentType.price.toNumber(),
        }
      : null,
  }));
}

interface ConflictCheck {
  doctorId: string;
  patientId: string;
  roomId?: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  excludeAppointmentId?: string;
}

export async function checkAppointmentConflicts({
  doctorId,
  patientId,
  roomId,
  date,
  startTime,
  endTime,
  excludeAppointmentId,
}: ConflictCheck): Promise<string[]> {
  // Validate required parameters
  if (!doctorId || !patientId) {
    throw new Error(
      "Se requiere el ID del doctor y del paciente para verificar conflictos"
    );
  }

  // Validate time range
  if (startTime >= endTime) {
    throw new Error(
      "La hora de inicio debe ser anterior a la hora de finalización"
    );
  }

  const conflicts: string[] = [];

  const whereClause: any = {
    date,
    isActive: true,
    status: { not: AppointmentStatus.CANCELLED },
    OR: [
      {
        // Overlapping appointments
        AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
      },
    ],
  };

  if (excludeAppointmentId) {
    whereClause.id = { not: excludeAppointmentId };
  }

  // Check doctor conflicts
  const doctorConflicts = await prisma.appointment.findMany({
    where: {
      ...whereClause,
      doctorId,
    },
    include: { patient: true },
  });

  if (doctorConflicts.length > 0) {
    conflicts.push(`El doctor no está disponible en este horario`);
  }

  // Check room conflicts
  if (roomId) {
    const roomConflicts = await prisma.appointment.findMany({
      where: {
        ...whereClause,
        roomId,
      },
      include: {
        doctor: {
          include: { user: true },
        },
      },
    });

    if (roomConflicts.length > 0) {
      conflicts.push(`El consultorio no está disponible en este horario`);
    }
  }

  // Check patient conflicts
  const patientConflicts = await prisma.appointment.findMany({
    where: {
      ...whereClause,
      patientId,
    },
    include: { doctor: true },
  });

  if (patientConflicts.length > 0) {
    conflicts.push(`El paciente ya tiene otra cita en este horario`);
  }

  return conflicts;
}

interface SlotCalculationOptions {
  doctorId: string;
  date: Date | string;
  clinicId: string;
  appointmentDurationMin?: number;
}

export async function calculateAvailableSlots({
  doctorId,
  date,
  clinicId,
  appointmentDurationMin = 30,
}: SlotCalculationOptions) {
  // Validate duration
  if (appointmentDurationMin < 5) {
    throw new Error("La duración de la cita debe ser al menos 5 minutos");
  }

  if (appointmentDurationMin > 480) {
    throw new Error("La duración de la cita no puede ser mayor a 8 horas");
  }

  // Validate doctor exists
  const doctorExists = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { id: true },
  });

  if (!doctorExists) {
    throw new Error("No se encontró el doctor seleccionado");
  }

  // Get clinic settings
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
  });

  if (!clinic) {
    throw new Error(
      "No se encontró la clínica. Por favor contacta al administrador"
    );
  }

  const slotMinutes = clinic.defaultSlotMinutes;
  const targetDate = new Date(date);
  const weekday = targetDate.getDay();

  // Convert date to string format (YYYY-MM-DD) for DoctorException queries
  const dateString =
    typeof date === "string"
      ? date
      : extractDateInClinicTimezone(date, clinic.timezone);

  // Get doctor's schedule for this weekday
  const schedules = await prisma.doctorSchedule.findMany({
    where: {
      doctorId,
      weekday,
      isActive: true,
      deletedAt: null,
    },
    orderBy: { startTime: "asc" },
  });

  // If no doctor-specific schedules exist, fallback to clinic schedules
  let effectiveSchedules: Array<{
    startTime: string;
    endTime: string;
    weekday: number;
  }> = schedules;

  if (schedules.length === 0) {
    const clinicSchedules = await prisma.clinicSchedule.findMany({
      where: {
        clinicId,
        weekday,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { startTime: "asc" },
    });
    effectiveSchedules = clinicSchedules;
  }

  // Check for doctor exceptions on this date
  const exceptions = await prisma.doctorException.findMany({
    where: {
      doctorId,
      date: dateString,
      isActive: true,
      deletedAt: null,
    },
  });

  // If there are exceptions, they override the regular schedule
  // Check if there's a full-day block
  const fullDayBlock = exceptions.find((e) => !e.startTime && !e.endTime);
  if (fullDayBlock) {
    return []; // Doctor is blocked for the entire day
  }

  // Get existing appointments for this date
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      date,
      isActive: true,
      deletedAt: null,
      status: { not: AppointmentStatus.CANCELLED },
    },
    select: {
      startTime: true,
      endTime: true,
    },
  });

  const availableSlots: Array<{ startTime: string; endTime: string }> = [];

  // Generate slots for each schedule block
  for (const schedule of effectiveSchedules) {
    const slots = generateSlotsForScheduleBlock(
      schedule.startTime,
      schedule.endTime,
      slotMinutes,
      appointmentDurationMin,
      existingAppointments,
      exceptions
    );
    availableSlots.push(...slots);
  }

  // Filter out past slots if date is today
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toTimeString().split(" ")[0].substring(0, 5);

  if (date === today) {
    return availableSlots.filter((slot) => slot.startTime > currentTime);
  }

  return availableSlots;
}

// Return availability (has slots) for each date in a range (inclusive)
export async function getDoctorAvailabilityRange(
  doctorId: string,
  clinicId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
) {
  // Validate date range
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Las fechas proporcionadas no son válidas");
  }

  if (start > end) {
    throw new Error(
      "La fecha de inicio debe ser anterior a la fecha de finalización"
    );
  }

  // Limit range to prevent excessive queries (max 90 days)
  const daysDiff = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysDiff > 90) {
    throw new Error("El rango de fechas no puede ser mayor a 90 días");
  }
  const results: Array<{ date: string; available: boolean }> = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    try {
      const slots = await calculateAvailableSlots({
        doctorId,
        date: dateStr,
        clinicId,
      });
      results.push({
        date: dateStr,
        available: Array.isArray(slots) && slots.length > 0,
      });
    } catch (err) {
      // On error, assume not available to be safe
      results.push({ date: dateStr, available: false });
    }
  }

  return results;
}

function generateSlotsForScheduleBlock(
  startTime: string,
  endTime: string,
  slotMinutes: number,
  appointmentDurationMin: number,
  existingAppointments: Array<{ startTime: string; endTime: string }>,
  exceptions: Array<{ startTime: string | null; endTime: string | null }> = []
): Array<{ startTime: string; endTime: string }> {
  const slots: Array<{ startTime: string; endTime: string }> = [];

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  for (
    let current = start;
    current + appointmentDurationMin <= end;
    current += slotMinutes
  ) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + appointmentDurationMin);

    // Check if slot conflicts with existing appointments
    const hasAppointmentConflict = existingAppointments.some((apt) =>
      timeOverlaps(slotStart, slotEnd, apt.startTime, apt.endTime)
    );

    // Check if slot conflicts with doctor exceptions (BLOCK periods)
    const hasExceptionConflict = exceptions.some((exc) => {
      if (exc.startTime && exc.endTime) {
        return timeOverlaps(slotStart, slotEnd, exc.startTime, exc.endTime);
      }
      return false;
    });

    if (!hasAppointmentConflict && !hasExceptionConflict) {
      slots.push({ startTime: slotStart, endTime: slotEnd });
    }
  }

  return slots;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
}

function timeOverlaps(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  return start1 < end2 && end1 > start2;
}
