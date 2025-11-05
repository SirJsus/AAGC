import { prisma } from "@/lib/db"
import { AppointmentStatus } from "@prisma/client"

interface DashboardMetrics {
  todayAppointments: number
  upcomingAppointments: number
  totalPatients: number
  totalDoctors: number
  noShowsThisMonth: number
  noShowPercentage: number
  occupancyRate: number
  estimatedIncome: number
}

export async function getDashboardMetrics(
  clinicId?: string | null,
  userRole?: string
): Promise<DashboardMetrics> {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  
  // First day of current month
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const firstDayStr = firstDayOfMonth.toISOString().split('T')[0]
  
  const baseWhere = userRole === "ADMIN" ? {} : { clinicId: clinicId || "" }

  // Today's appointments count
  const todayAppointments = await prisma.appointment.count({
    where: {
      ...baseWhere,
      date: todayStr,
      status: { notIn: [AppointmentStatus.CANCELLED] },
      isActive: true,
      deletedAt: null,
    },
  })

  // Upcoming appointments (pending or confirmed)
  const upcomingAppointments = await prisma.appointment.count({
    where: {
      ...baseWhere,
      date: { gte: todayStr },
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      isActive: true,
      deletedAt: null,
    },
  })

  // Total active patients
  const totalPatients = await prisma.patient.count({
    where: {
      ...baseWhere,
      isActive: true,
      deletedAt: null,
    },
  })

  // Total active doctors
  const totalDoctors = await prisma.doctor.count({
    where: {
      ...baseWhere,
      isActive: true,
      deletedAt: null,
    },
  })

  // No-shows this month
  const noShowsThisMonth = await prisma.appointment.count({
    where: {
      ...baseWhere,
      date: { gte: firstDayStr },
      status: AppointmentStatus.NO_SHOW,
      isActive: true,
      deletedAt: null,
    },
  })

  // Total appointments this month for percentage calculation
  const totalAppointmentsThisMonth = await prisma.appointment.count({
    where: {
      ...baseWhere,
      date: { gte: firstDayStr },
      isActive: true,
      deletedAt: null,
    },
  })

  const noShowPercentage = totalAppointmentsThisMonth > 0
    ? (noShowsThisMonth / totalAppointmentsThisMonth) * 100
    : 0

  // Occupancy rate for today
  const occupancyRate = await calculateOccupancyRate(todayStr, clinicId, userRole)

  // Estimated income for today
  const estimatedIncome = await calculateEstimatedIncome(todayStr, clinicId, userRole)

  return {
    todayAppointments,
    upcomingAppointments,
    totalPatients,
    totalDoctors,
    noShowsThisMonth,
    noShowPercentage,
    occupancyRate,
    estimatedIncome,
  }
}

async function calculateOccupancyRate(
  date: string,
  clinicId?: string | null,
  userRole?: string
): Promise<number> {
  const baseWhere = userRole === "ADMIN" ? {} : { clinicId: clinicId || "" }
  
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
  })

  if (doctors.length === 0) return 0

  const targetDate = new Date(date)
  const weekday = targetDate.getDay()

  let totalPossibleSlots = 0
  let occupiedSlots = 0

  for (const doctor of doctors) {
    // Find schedules for this weekday
    const daySchedules = doctor.schedules.filter(s => s.weekday === weekday)
    
    for (const schedule of daySchedules) {
      const startMinutes = timeToMinutes(schedule.startTime)
      const endMinutes = timeToMinutes(schedule.endTime)
      const durationMinutes = endMinutes - startMinutes
      
      // Calculate number of slots based on clinic's default slot duration
      const slotDuration = doctor.clinic.defaultSlotMinutes
      const slotsInSchedule = Math.floor(durationMinutes / slotDuration)
      totalPossibleSlots += slotsInSchedule
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
    })
    
    occupiedSlots += appointments
  }

  return totalPossibleSlots > 0
    ? (occupiedSlots / totalPossibleSlots) * 100
    : 0
}

async function calculateEstimatedIncome(
  date: string,
  clinicId?: string | null,
  userRole?: string
): Promise<number> {
  const baseWhere = userRole === "ADMIN" ? {} : { clinicId: clinicId || "" }

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
  })

  let totalIncome = 0

  for (const appointment of appointments) {
    if (appointment.customPrice) {
      totalIncome += Number(appointment.customPrice)
    } else if (appointment.appointmentType) {
      totalIncome += Number(appointment.appointmentType.price)
    }
  }

  return totalIncome
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export async function getDoctorMetrics(doctorId: string) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  
  // Get start of current week (Sunday)
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  const startOfWeekStr = startOfWeek.toISOString().split('T')[0]
  
  // Get end of current week (Saturday)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  const endOfWeekStr = endOfWeek.toISOString().split('T')[0]

  const [
    todayTotal,
    todayCompleted,
    weekTotal,
    weekUpcoming
  ] = await Promise.all([
    prisma.appointment.count({
      where: {
        doctorId,
        date: todayStr,
        status: { notIn: [AppointmentStatus.CANCELLED] },
        isActive: true,
        deletedAt: null,
      },
    }),
    prisma.appointment.count({
      where: {
        doctorId,
        date: todayStr,
        status: AppointmentStatus.COMPLETED,
        isActive: true,
        deletedAt: null,
      },
    }),
    prisma.appointment.count({
      where: {
        doctorId,
        date: { gte: startOfWeekStr, lte: endOfWeekStr },
        isActive: true,
        deletedAt: null,
      },
    }),
    prisma.appointment.count({
      where: {
        doctorId,
        date: { gte: startOfWeekStr, lte: endOfWeekStr },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        isActive: true,
        deletedAt: null,
      },
    }),
  ])

  return {
    todayTotal,
    todayCompleted,
    weekTotal,
    weekUpcoming,
  }
}
