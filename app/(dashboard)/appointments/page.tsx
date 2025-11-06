import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Permissions } from "@/lib/permissions";
import { Header } from "@/components/layout/header";
import { getAppointments } from "@/lib/actions/appointments";
import { AppointmentsTable } from "@/components/appointments/appointments-table";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewAppointments(session.user)) {
    redirect("/dashboard");
  }

  const appointments = await getAppointments();

  return (
    <div className="space-y-6">
      <Header
        title="Appointments"
        description="Manage patient appointments and scheduling"
      />
      <AppointmentsTable appointments={appointments as any} />
    </div>
  );
}
