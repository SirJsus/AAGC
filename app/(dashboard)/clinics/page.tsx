import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Permissions } from "@/lib/permissions";
import { Header } from "@/components/layout/header";
import { getClinics } from "@/lib/actions/clinics";
import { ClinicsTable } from "@/components/clinics/clinics-table";

export const dynamic = "force-dynamic";

interface ClinicsPageProps {
  searchParams: {
    search?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  };
}

export default async function ClinicsPage({ searchParams }: ClinicsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageClinics(session.user)) {
    redirect("/dashboard");
  }

  const page = parseInt(searchParams.page || "1");
  const pageSize = parseInt(searchParams.pageSize || "20");

  const { clinics, total, totalPages, currentPage } = await getClinics({
    search: searchParams.search,
    status: searchParams.status || "all",
    page,
    pageSize,
  });

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
        total={total}
        totalPages={totalPages}
        currentPage={currentPage}
      />
    </div>
  );
}
