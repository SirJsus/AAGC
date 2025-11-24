import { prisma } from "@/lib/db";
import { AppointmentStatus } from "@prisma/client";
import { formatDateForInput } from "@/lib/utils/timezone";

interface DashboardMetrics {
  todayAppointments: number;
  upcomingAppointments: number;
  totalPatients: number;
  totalDoctors: number;
  noShowsThisMonth: number;
  noShowPercentage: number;
  occupancyRate: number;
  estimatedIncome: number;
}

export async function getDashboardMetrics(
  clinicId?: string | null,
  userRole?: string
): Promise<DashboardMetrics> {
  const today = new Date();

  // Get the clinic's timezone (if clinicId is provided)
  let timezone = "America/Mexico_City"; // Default fallback
  if (clinicId) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    if (clinic?.timezone) {
      timezone = clinic.timezone;
    }
  }

  // Convert today to UTC DateTime at midnight in clinic timezone
  const todayUTC = formatDateForInput(today, timezone);

  // First day of current month at midnight in clinic timezone, converted to UTC
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstDayUTC = formatDateForInput(firstDayOfMonth, timezone);

  const baseWhere = userRole === "ADMIN" ? {} : { clinicId: clinicId || "" };

  // Today's appointments count
  const todayAppointments = await prisma.appointment.count({
    where: {
      ...baseWhere,
      date: todayUTC,
      status: { notIn: [AppointmentStatus.CANCELLED] },
      isActive: true,
      deletedAt: null,
    },
  });

  // Upcoming appointments (pending or confirmed)
  const upcomingAppointments = await prisma.appointment.count({
    where: {
      ...baseWhere,
      date: { gte: todayUTC },
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      isActive: true,
      deletedAt: null,
    },
  });

  // Total active patients
  const totalPatients = await prisma.patient.count({
    where: {
      ...baseWhere,
      isActive: true,
      deletedAt: null,
    },
  });

  // Total active doctors
  const totalDoctors = await prisma.doctor.count({
    where: {
      ...baseWhere,
      isActive: true,
      deletedAt: null,
    },
  });

  // No-shows this month
  const noShowsThisMonth = await prisma.appointment.count({
    where: {
      ...baseWhere,
      date: { gte: firstDayUTC },
      status: AppointmentStatus.NO_SHOW,
      isActive: true,
      deletedAt: null,
    },
  });

  // Total appointments this month for percentage calculation
  const totalAppointmentsThisMonth = await prisma.appointment.count({
    where: {
      ...baseWhere,
      date: { gte: firstDayUTC },
      isActive: true,
      deletedAt: null,
    },
  });

  const noShowPercentage =
    totalAppointmentsThisMonth > 0
      ? (noShowsThisMonth / totalAppointmentsThisMonth) * 100
      : 0;

  // Occupancy rate for today
  const occupancyRate = await calculateOccupancyRate(
    todayUTC,
    clinicId,
    userRole
  );

  // Estimated income for today
  const estimatedIncome = await calculateEstimatedIncome(
    todayUTC,
    clinicId,
    userRole
  );

  return {
    todayAppointments,
    upcomingAppointments,
    totalPatients,
    totalDoctors,
    noShowsThisMonth,
    noShowPercentage,
    occupancyRate,
    estimatedIncome,
  };
}

async function calculateOccupancyRate(
  date: Date,
  clinicId?: string | null,
  userRole?: string
): Promise<number> {
  const baseWhere = userRole === "ADMIN" ? {} : { clinicId: clinicId || "" };

  // Get all active doctors
  const doctors = await prisma.doctor.findMany({
    where: {
      ...baseWhere,
      isActive: true,
      deletedAt: null,
    },
    include: {
      schedules: {
        where: {
          isActive: true,
          deletedAt: null,
        },
      },
      clinic: true,
    },
  });

  if (doctors.length === 0) return 0;

  const targetDate = new Date(date);
  const weekday = targetDate.getDay();

  let totalPossibleSlots = 0;
  let occupiedSlots = 0;

  for (const doctor of doctors) {
    // Find schedules for this weekday
    const daySchedules = doctor.schedules.filter((s) => s.weekday === weekday);

    for (const schedule of daySchedules) {
      const startMinutes = timeToMinutes(schedule.startTime);
      const endMinutes = timeToMinutes(schedule.endTime);
      const durationMinutes = endMinutes - startMinutes;

      // Calculate number of slots based on clinic's default slot duration
      const slotDuration = doctor.clinic.defaultSlotMinutes;
      const slotsInSchedule = Math.floor(durationMinutes / slotDuration);
      totalPossibleSlots += slotsInSchedule;
    }

    // Count occupied slots (appointments) for this doctor
    const appointments = await prisma.appointment.count({
      where: {
        doctorId: doctor.id,
        date,
        status: { notIn: [AppointmentStatus.CANCELLED] },
        isActive: true,
        deletedAt: null,
      },
    });

    occupiedSlots += appointments;
  }

  return totalPossibleSlots > 0
    ? (occupiedSlots / totalPossibleSlots) * 100
    : 0;
}

async function calculateEstimatedIncome(
  date: Date,
  clinicId?: string | null,
  userRole?: string
): Promise<number> {
  const baseWhere = userRole === "ADMIN" ? {} : { clinicId: clinicId || "" };

  const appointments = await prisma.appointment.findMany({
    where: {
      ...baseWhere,
      date,
      status: { notIn: [AppointmentStatus.CANCELLED] },
      isActive: true,
      deletedAt: null,
    },
    include: {
      appointmentType: true,
    },
  });

  let totalIncome = 0;

  for (const appointment of appointments) {
    if (appointment.customPrice) {
      totalIncome += Number(appointment.customPrice);
    } else if (appointment.appointmentType) {
      totalIncome += Number(appointment.appointmentType.price);
    }
  }

  return totalIncome;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export async function getDoctorMetrics(doctorId: string) {
  const today = new Date();

  // Get the doctor's clinic timezone
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      clinic: {
        select: { timezone: true },
      },
    },
  });

  const timezone = doctor?.clinic?.timezone || "America/Mexico_City"; // Default fallback

  // Convert today to UTC DateTime at midnight in clinic timezone
  const todayUTC = formatDateForInput(today, timezone);

  // Get start of current week (Sunday) at midnight in clinic timezone
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const startOfWeekUTC = formatDateForInput(startOfWeek, timezone);

  // Get end of current week (Saturday) at midnight in clinic timezone
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const endOfWeekUTC = formatDateForInput(endOfWeek, timezone);

  const [todayTotal, todayCompleted, weekTotal, weekUpcoming] =
    await Promise.all([
      prisma.appointment.count({
        where: {
          doctorId,
          date: todayUTC,
          status: { notIn: [AppointmentStatus.CANCELLED] },
          isActive: true,
          deletedAt: null,
        },
      }),
      prisma.appointment.count({
        where: {
          doctorId,
          date: todayUTC,
          status: AppointmentStatus.COMPLETED,
          isActive: true,
          deletedAt: null,
        },
      }),
      prisma.appointment.count({
        where: {
          doctorId,
          date: { gte: startOfWeekUTC, lte: endOfWeekUTC },
          isActive: true,
          deletedAt: null,
        },
      }),
      prisma.appointment.count({
        where: {
          doctorId,
          date: { gte: startOfWeekUTC, lte: endOfWeekUTC },
          status: {
            in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
          },
          isActive: true,
          deletedAt: null,
        },
      }),
    ]);

  return {
    todayTotal,
    todayCompleted,
    weekTotal,
    weekUpcoming,
  };
}

// Simplified metrics for ADMIN/CLINIC_ADMIN focused on TODAY only
export async function getTodayMetrics(
  clinicId?: string | null,
  userRole?: string
) {
  const today = new Date();

  // Get the clinic's timezone (if clinicId is provided)
  let timezone = "America/Mexico_City";
  if (clinicId) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    if (clinic?.timezone) {
      timezone = clinic.timezone;
    }
  }

  const todayUTC = formatDateForInput(today, timezone);
  const baseWhere = userRole === "ADMIN" ? {} : { clinicId: clinicId || "" };

  // Get today's appointments with details
  const todayAppointments = await prisma.appointment.findMany({
    where: {
      ...baseWhere,
      date: todayUTC,
      isActive: true,
      deletedAt: null,
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          pendingCompletion: true,
        },
      },
      appointmentType: true,
    },
  });

  // Count by status
  const total = todayAppointments.length;
  const completed = todayAppointments.filter(
    (a) =>
      a.status === AppointmentStatus.COMPLETED ||
      a.status === AppointmentStatus.PAID
  ).length;
  const pending = todayAppointments.filter(
    (a) =>
      a.status === AppointmentStatus.PENDING ||
      a.status === AppointmentStatus.CONFIRMED
  ).length;
  const inProgress = todayAppointments.filter(
    (a) => a.status === AppointmentStatus.IN_CONSULTATION
  ).length;

  // Calculate today's confirmed income
  const confirmedIncome = todayAppointments
    .filter(
      (a) =>
        a.status === AppointmentStatus.COMPLETED ||
        a.status === AppointmentStatus.PAID
    )
    .reduce((sum, apt) => {
      const price = apt.customPrice || apt.appointmentType?.price || 0;
      return sum + Number(price);
    }, 0);

  // Count patients with incomplete data
  const incompletePatients = await prisma.patient.count({
    where: {
      ...baseWhere,
      pendingCompletion: true,
      isActive: true,
      deletedAt: null,
    },
  });

  // Count unconfirmed upcoming appointments (today and future)
  const unconfirmedAppointments = await prisma.appointment.count({
    where: {
      ...baseWhere,
      date: { gte: todayUTC },
      status: AppointmentStatus.PENDING,
      isActive: true,
      deletedAt: null,
    },
  });

  // Count pending payments
  const pendingPayments = todayAppointments.filter(
    (a) => a.status === AppointmentStatus.TRANSFER_PENDING
  ).length;

  return {
    total,
    completed,
    pending,
    inProgress,
    confirmedIncome,
    incompletePatients,
    unconfirmedAppointments,
    pendingPayments,
  };
}
