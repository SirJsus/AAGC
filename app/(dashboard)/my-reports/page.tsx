import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Permissions } from "@/lib/permissions";
import { DoctorReportsContainer } from "@/components/reports/doctor-reports-container";

export const dynamic = "force-dynamic";

export default async function MyReportsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;

  // Solo DOCTOR puede acceder a sus propios reportes
  if (
    !Permissions.canViewOwnReports({ role: user.role, clinicId: user.clinicId })
  ) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4">
      <Header
        title="Mis Reportes"
        description="Análisis y estadísticas de tus citas"
      />
      <DoctorReportsContainer user={user} />
    </div>
  );
}
