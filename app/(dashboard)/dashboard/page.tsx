import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Users,
  Stethoscope,
  Clock,
  TrendingUp,
  Activity,
  UserCheck,
  CalendarDays,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import {
  getDashboardMetrics,
  getDoctorMetrics,
  getTodayMetrics,
} from "@/lib/utils/dashboard-metrics";
import { formatDateForInput } from "@/lib/utils/timezone";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;

  // Get user's doctor record if they are a doctor
  let doctorRecord = null;
  if (user.role === "DOCTOR") {
    doctorRecord = await prisma.doctor.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
  }

  // Render different dashboard based on role
  if (user.role === "DOCTOR" && doctorRecord) {
    return <DoctorDashboard doctorId={doctorRecord.id} user={user} />;
  } else if (user.role === "NURSE") {
    redirect("/appointments");
  } else {
    return <AdminClinicDashboard user={user} />;
  }
}

// Admin and Clinic Admin Dashboard
async function AdminClinicDashboard({ user }: { user: any }) {
  const metrics = await getTodayMetrics(user.clinicId, user.role);

  const today = new Date();

  // Get the clinic's timezone
  let timezone = "America/Mexico_City";
  if (user.clinicId) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: user.clinicId },
      select: { timezone: true },
    });
    if (clinic?.timezone) {
      timezone = clinic.timezone;
    }
  }

  // Convert today to UTC DateTime at midnight in clinic timezone
  const todayUTC = formatDateForInput(today, timezone);

  // Get today's appointments list
  const baseWhere =
    user.role === "ADMIN" ? {} : { clinicId: user.clinicId || "" };

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
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      doctor: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      appointmentType: true,
      room: true,
    },
    orderBy: { startTime: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Header
          title="Dashboard"
          description={`Bienvenido, ${user.firstName}. Resumen operativo de hoy.`}
        />
      </div>

      {/* Quick Actions and Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <a
                href="/appointments"
                className="flex-1 flex flex-col items-center justify-center p-4 rounded-lg border hover:bg-accent transition-colors min-h-[100px]"
              >
                <Calendar className="h-6 w-6 mb-2 text-blue-600" />
                <span className="font-medium text-sm text-center">
                  Nueva Cita
                </span>
              </a>
              <a
                href="/patients"
                className="flex-1 flex flex-col items-center justify-center p-4 rounded-lg border hover:bg-accent transition-colors min-h-[100px]"
              >
                <Users className="h-6 w-6 mb-2 text-green-600" />
                <span className="font-medium text-sm text-center">
                  Registrar Paciente
                </span>
              </a>
              <a
                href="/reports"
                className="flex-1 flex flex-col items-center justify-center p-4 rounded-lg border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors min-h-[100px]"
              >
                <TrendingUp className="h-6 w-6 mb-2 text-purple-600" />
                <span className="font-medium text-sm text-center text-purple-900">
                  Reportes
                </span>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              Información
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Rol</span>
              <span className="font-medium">
                {user.role === "ADMIN"
                  ? "Administrador"
                  : user.role === "CLINIC_ADMIN"
                    ? "Admin de Clínica"
                    : user.role}
              </span>
            </div>
            {user.clinicName && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Clínica</span>
                <span className="font-medium">{user.clinicName}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Fecha</span>
              <span className="font-medium">
                {today.toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Citas de Hoy</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {metrics.total}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.completed} completadas • {metrics.pending} pendientes
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {metrics.inProgress}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Consultas activas ahora
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ingresos Confirmados
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              $
              {metrics.confirmedIncome.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Solo citas completadas hoy
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Acciones Requeridas
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {metrics.incompletePatients +
                metrics.unconfirmedAppointments +
                metrics.pendingPayments}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tareas pendientes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {(metrics.incompletePatients > 0 ||
        metrics.unconfirmedAppointments > 0 ||
        metrics.pendingPayments > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Alertas y Acciones Requeridas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.incompletePatients > 0 && (
              <a
                href="/patients?pendingCompletion=pending"
                className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-900">
                    {metrics.incompletePatients} paciente(s) con datos
                    incompletos
                  </span>
                </div>
                <span className="text-sm text-orange-600">Ver →</span>
              </a>
            )}
            {metrics.unconfirmedAppointments > 0 && (
              <a
                href="/appointments?status=PENDING"
                className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900">
                    {metrics.unconfirmedAppointments} cita(s) sin confirmar
                  </span>
                </div>
                <span className="text-sm text-blue-600">Ver →</span>
              </a>
            )}
            {metrics.pendingPayments > 0 && (
              <a
                href="/appointments?status=TRANSFER_PENDING"
                className="flex items-center justify-between p-3 rounded-lg border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium text-yellow-900">
                    {metrics.pendingPayments} pago(s) pendiente(s) de hoy
                  </span>
                </div>
                <span className="text-sm text-yellow-600">Ver →</span>
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Agenda de Hoy</CardTitle>
          <CardDescription>
            {today.toLocaleDateString("es-MX", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay citas programadas para hoy
            </p>
          ) : (
            <div className="space-y-2">
              {todayAppointments.map((apt) => (
                <a
                  key={apt.id}
                  href={`/appointments/${apt.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="text-sm font-medium text-blue-600 min-w-[100px]">
                      {apt.startTime} - {apt.endTime}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {apt.patient.firstName} {apt.patient.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Dr. {apt.doctor.user.firstName}{" "}
                        {apt.doctor.user.lastName}
                        {apt.appointmentType &&
                          ` • ${apt.appointmentType.name}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {apt.room && (
                      <span className="text-xs text-muted-foreground">
                        {apt.room.name}
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                        apt.status === "COMPLETED" || apt.status === "PAID"
                          ? "bg-green-100 text-green-700"
                          : apt.status === "IN_CONSULTATION"
                            ? "bg-purple-100 text-purple-700"
                            : apt.status === "CONFIRMED"
                              ? "bg-blue-100 text-blue-700"
                              : apt.status === "PENDING"
                                ? "bg-yellow-100 text-yellow-700"
                                : apt.status === "TRANSFER_PENDING"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {apt.status === "COMPLETED"
                        ? "Completada"
                        : apt.status === "PAID"
                          ? "Pagada"
                          : apt.status === "IN_CONSULTATION"
                            ? "En Consulta"
                            : apt.status === "CONFIRMED"
                              ? "Confirmada"
                              : apt.status === "PENDING"
                                ? "Pendiente"
                                : apt.status === "TRANSFER_PENDING"
                                  ? "Pago Pendiente"
                                  : apt.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Doctor Dashboard
async function DoctorDashboard({
  doctorId,
  user,
}: {
  doctorId: string;
  user: any;
}) {
  const metrics = await getDoctorMetrics(doctorId);

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

  const timezone = doctor?.clinic?.timezone || "America/Mexico_City";
  const todayUTC = formatDateForInput(today, timezone);

  // Get today's appointments
  const todayAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      date: todayUTC,
      isActive: true,
      deletedAt: null,
    },
    include: {
      patient: true,
      appointmentType: true,
      room: true,
    },
    orderBy: { startTime: "asc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <Header
        title="Doctor Dashboard"
        description={`Welcome, Dr. ${user.lastName}. Here's your schedule overview.`}
      />

      {/* Doctor Metrics */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Total</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {metrics.todayTotal}
            </div>
            <p className="text-xs text-muted-foreground">Appointments today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Today
            </CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics.todayCompleted}
            </div>
            <p className="text-xs text-muted-foreground">
              Finished appointments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <CalendarDays className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {metrics.weekTotal}
            </div>
            <p className="text-xs text-muted-foreground">Total this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {metrics.weekUpcoming}
            </div>
            <p className="text-xs text-muted-foreground">Pending this week</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Appointments */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Schedule</CardTitle>
          <CardDescription>
            Your appointments for{" "}
            {today.toLocaleDateString("es-MX", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No appointments scheduled for today
            </p>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium text-blue-600 min-w-[80px]">
                      {apt.startTime} - {apt.endTime}
                    </div>
                    <div>
                      <div className="font-medium">
                        {apt.patient.firstName} {apt.patient.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {apt.appointmentType?.name ||
                          apt.customReason ||
                          "General consultation"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        apt.status === "COMPLETED"
                          ? "bg-green-100 text-green-700"
                          : apt.status === "IN_CONSULTATION"
                            ? "bg-purple-100 text-purple-700"
                            : apt.status === "CONFIRMED"
                              ? "bg-blue-100 text-blue-700"
                              : apt.status === "PENDING"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {apt.status.replace("_", " ")}
                    </span>
                    <a
                      href={`/appointments/${apt.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
