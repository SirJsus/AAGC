import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Permissions } from "@/lib/permissions";
import { ReportsContainer } from "@/components/reports/reports-container";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;

  // Solo ADMIN y CLINIC_ADMIN pueden acceder a reportes
  if (
    !Permissions.canViewReports({ role: user.role, clinicId: user.clinicId })
  ) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4">
      <Header
        title="Sistema de Reportes"
        description="Análisis y estadísticas de la clínica"
      />
      <ReportsContainer user={user} />
    </div>
  );
}
