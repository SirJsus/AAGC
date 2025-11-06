import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Permissions } from "@/lib/permissions";
import { Header } from "@/components/layout/header";
import { getClinics } from "@/lib/actions/clinics";
import { ClinicsTable } from "@/components/clinics/clinics-table";

export const dynamic = "force-dynamic";

export default async function ClinicsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageClinics(session.user)) {
    redirect("/dashboard");
  }

  const clinics = await getClinics();

  return (
    <div className="space-y-6">
      <Header
        title="Clinics"
        description="Manage medical clinics in the system"
      />
      <ClinicsTable
        clinics={clinics}
        userRole={session.user.role}
        userClinicId={session.user.clinicId}
      />
    </div>
  );
}
