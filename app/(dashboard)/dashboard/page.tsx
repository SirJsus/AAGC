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
  PieChart,
  AlertCircle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import {
  getDashboardMetrics,
  getDoctorMetrics,
} from "@/lib/utils/dashboard-metrics";
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
  const metrics = await getDashboardMetrics(user.clinicId, user.role);

  // Get all clinics for ADMIN dropdown
  const clinics =
    user.role === "ADMIN"
      ? await prisma.clinic.findMany({
          where: { isActive: true, deletedAt: null },
          select: { id: true, name: true },
        })
      : [];

  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Header
          title="Dashboard"
          description={`Welcome back, ${user.firstName}. Here's your clinic overview for today.`}
        />
        {user.role === "ADMIN" && clinics.length > 1 && (
          <div className="w-64">
            <Select defaultValue={user.clinicId || "all"}>
              <SelectTrigger>
                <SelectValue placeholder="Select clinic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clinics</SelectItem>
                {clinics.map((clinic) => (
                  <SelectItem key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Appointments
            </CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {metrics.todayAppointments}
            </div>
            <p className="text-xs text-muted-foreground">
              Appointments scheduled for today
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Occupancy Rate
            </CardTitle>
            <PieChart className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {metrics.occupancyRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Slots occupied today
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Estimated Income
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              $
              {metrics.estimatedIncome.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Today's expected revenue
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              No-Shows This Month
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {metrics.noShowsThisMonth} ({metrics.noShowPercentage.toFixed(1)}
              %)
            </div>
            <p className="text-xs text-muted-foreground">Missed appointments</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Upcoming Appointments
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.upcomingAppointments}
            </div>
            <p className="text-xs text-muted-foreground">Pending & confirmed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Patients
            </CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalPatients}</div>
            <p className="text-xs text-muted-foreground">Active patients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Doctors
            </CardTitle>
            <Stethoscope className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalDoctors}</div>
            <p className="text-xs text-muted-foreground">Medical staff</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common tasks you can perform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="/appointments/new"
              className="flex items-center p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <Calendar className="h-4 w-4 mr-3 text-blue-600" />
              <span className="font-medium">Schedule New Appointment</span>
            </a>
            <a
              href="/patients"
              className="flex items-center p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <Users className="h-4 w-4 mr-3 text-green-600" />
              <span className="font-medium">Register Patient</span>
            </a>
            <a
              href="/appointments"
              className="flex items-center p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <Clock className="h-4 w-4 mr-3 text-orange-600" />
              <span className="font-medium">View All Appointments</span>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              System Information
            </CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Role</span>
              <span className="font-medium">{user.role.replace("_", " ")}</span>
            </div>
            {user.clinicName && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Clinic</span>
                <span className="font-medium">{user.clinicName}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Today's Date
              </span>
              <span className="font-medium">
                {today.toLocaleDateString("es-MX", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
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
  const todayStr = today.toISOString().split("T")[0];

  // Get today's appointments
  const todayAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      date: todayStr,
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
