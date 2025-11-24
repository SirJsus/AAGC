import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Permissions } from "@/lib/permissions";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user;

    // Solo DOCTOR puede acceder a sus propios reportes
    if (
      !Permissions.canViewOwnReports({
        role: user.role,
        clinicId: user.clinicId,
      })
    ) {
      return NextResponse.json(
        { error: "No tienes permisos para ver reportes" },
        { status: 403 }
      );
    }

    // Obtener el doctor asociado al usuario
    const doctor = await prisma.doctor.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!doctor) {
      return NextResponse.json(
        { error: "No se encontró el perfil de doctor" },
        { status: 404 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "month"; // day, week, month, year, custom
    const appointmentTypeId = searchParams.get("appointmentTypeId"); // null = todos
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Determinar rango de fechas
    let dateFrom: Date;
    let dateTo: Date;

    if (period === "custom" && startDate && endDate) {
      dateFrom = startOfDay(new Date(startDate));
      dateTo = endOfDay(new Date(endDate));
    } else {
      const now = new Date();
      switch (period) {
        case "day":
          dateFrom = startOfDay(now);
          dateTo = endOfDay(now);
          break;
        case "week":
          dateFrom = startOfWeek(now, { weekStartsOn: 1 });
          dateTo = endOfWeek(now, { weekStartsOn: 1 });
          break;
        case "year":
          dateFrom = startOfYear(now);
          dateTo = endOfYear(now);
          break;
        case "month":
        default:
          dateFrom = startOfMonth(now);
          dateTo = endOfMonth(now);
          break;
      }
    }

    // Construir filtros - siempre filtrar por el doctor actual
    const where: any = {
      doctorId: doctor.id, // Filtro automático por el doctor actual
      date: {
        gte: dateFrom,
        lte: dateTo,
      },
      isActive: true,
    };

    // Filtro por tipo de cita
    if (appointmentTypeId && appointmentTypeId !== "all") {
      where.appointmentTypeId = appointmentTypeId;
    }

    // Obtener citas del período
    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                secondLastName: true,
              },
            },
          },
        },
        appointmentType: {
          select: {
            name: true,
            price: true,
          },
        },
        patient: {
          select: {
            firstName: true,
            lastName: true,
            secondLastName: true,
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    // Calcular métricas
    const totalAppointments = appointments.length;
    const appointmentsByStatus = appointments.reduce(
      (acc, apt) => {
        acc[apt.status] = (acc[apt.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Estadísticas del doctor (aunque es solo uno, mantener consistencia)
    const appointmentsByDoctor = appointments.reduce(
      (acc, apt) => {
        const doctorName = `${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`;
        if (!acc[doctorName]) {
          acc[doctorName] = {
            count: 0,
            completed: 0,
            cancelled: 0,
            noShow: 0,
            revenue: 0,
          };
        }
        acc[doctorName].count++;
        if (apt.status === "COMPLETED" || apt.status === "PAID") {
          acc[doctorName].completed++;
          const price = apt.customPrice || apt.appointmentType?.price || 0;
          acc[doctorName].revenue += Number(price);
        }
        if (apt.status === "CANCELLED") acc[doctorName].cancelled++;
        if (apt.status === "NO_SHOW") acc[doctorName].noShow++;
        return acc;
      },
      {} as Record<string, any>
    );

    const appointmentsByType = appointments.reduce(
      (acc, apt) => {
        const typeName = apt.appointmentType?.name || "Sin tipo";
        if (!acc[typeName]) {
          acc[typeName] = {
            count: 0,
            revenue: 0,
          };
        }
        acc[typeName].count++;
        if (apt.status === "COMPLETED" || apt.status === "PAID") {
          const price = apt.customPrice || apt.appointmentType?.price || 0;
          acc[typeName].revenue += Number(price);
        }
        return acc;
      },
      {} as Record<string, any>
    );

    // Ingresos totales y proyectados
    const totalRevenue = appointments
      .filter((apt) => apt.status === "COMPLETED" || apt.status === "PAID")
      .reduce((sum, apt) => {
        const price = apt.customPrice || apt.appointmentType?.price || 0;
        return sum + Number(price);
      }, 0);

    const projectedRevenue = appointments
      .filter((apt) => apt.status === "PENDING" || apt.status === "CONFIRMED")
      .reduce((sum, apt) => {
        const price = apt.customPrice || apt.appointmentType?.price || 0;
        return sum + Number(price);
      }, 0);

    // Citas por día de la semana
    const appointmentsByWeekday = appointments.reduce(
      (acc, apt) => {
        const day = new Date(apt.date).getDay();
        const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
        const dayName = dayNames[day];
        acc[dayName] = (acc[dayName] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Citas por hora del día
    const appointmentsByHour = appointments.reduce(
      (acc, apt) => {
        const hour = apt.startTime.split(":")[0];
        const hourLabel = `${hour}:00`;
        acc[hourLabel] = (acc[hourLabel] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Ingresos por método de pago
    const revenueByPaymentMethod = appointments
      .filter(
        (apt) =>
          (apt.status === "COMPLETED" || apt.status === "PAID") &&
          apt.paymentMethod
      )
      .reduce(
        (acc, apt) => {
          const method = apt.paymentMethod!;
          const price = apt.customPrice || apt.appointmentType?.price || 0;
          acc[method] = (acc[method] || 0) + Number(price);
          return acc;
        },
        {} as Record<string, number>
      );

    // Tasa de cancelación y no-show
    const cancelledCount = appointmentsByStatus["CANCELLED"] || 0;
    const noShowCount = appointmentsByStatus["NO_SHOW"] || 0;
    const cancellationRate =
      totalAppointments > 0
        ? ((cancelledCount + noShowCount) / totalAppointments) * 100
        : 0;

    // Comparativa con período anterior
    let previousPeriodFrom: Date;
    let previousPeriodTo: Date;

    switch (period) {
      case "day":
        previousPeriodFrom = startOfDay(subDays(dateFrom, 1));
        previousPeriodTo = endOfDay(subDays(dateTo, 1));
        break;
      case "week":
        previousPeriodFrom = startOfWeek(subDays(dateFrom, 7), {
          weekStartsOn: 1,
        });
        previousPeriodTo = endOfWeek(subDays(dateTo, 7), { weekStartsOn: 1 });
        break;
      case "year":
        previousPeriodFrom = startOfYear(subYears(dateFrom, 1));
        previousPeriodTo = endOfYear(subYears(dateTo, 1));
        break;
      case "month":
      default:
        previousPeriodFrom = startOfMonth(subMonths(dateFrom, 1));
        previousPeriodTo = endOfMonth(subMonths(dateTo, 1));
        break;
    }

    const previousWhere = {
      ...where,
      date: { gte: previousPeriodFrom, lte: previousPeriodTo },
    };
    const previousAppointments = await prisma.appointment.count({
      where: previousWhere,
    });
    const appointmentChange =
      previousAppointments > 0
        ? ((totalAppointments - previousAppointments) / previousAppointments) *
          100
        : 0;

    return NextResponse.json({
      period,
      dateRange: {
        from: dateFrom.toISOString(),
        to: dateTo.toISOString(),
      },
      summary: {
        totalAppointments,
        totalRevenue,
        projectedRevenue,
        cancellationRate: cancellationRate.toFixed(2),
        appointmentChange: appointmentChange.toFixed(2),
      },
      appointmentsByStatus,
      appointmentsByDoctor,
      appointmentsByType,
      appointmentsByWeekday,
      appointmentsByHour,
      revenueByPaymentMethod,
    });
  } catch (error) {
    console.error("Error fetching doctor reports:", error);
    return NextResponse.json(
      { error: "Error al obtener los reportes" },
      { status: 500 }
    );
  }
}
