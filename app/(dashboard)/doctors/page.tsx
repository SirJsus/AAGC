import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Permissions } from "@/lib/permissions";
import { Header } from "@/components/layout/header";
import { getDoctors, getDoctorSpecialties } from "@/lib/actions/doctors";
import { getClinics } from "@/lib/actions/clinics";
import { DoctorsTable } from "@/components/doctors/doctors-table";

export const dynamic = "force-dynamic";

interface DoctorsPageProps {
  searchParams: {
    search?: string;
    status?: string;
    clinicId?: string;
    specialty?: string;
    page?: string;
    pageSize?: string;
  };
}

export default async function DoctorsPage({ searchParams }: DoctorsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewDoctors(session.user)) {
    redirect("/dashboard");
  }

  const page = parseInt(searchParams.page || "1");
  const pageSize = parseInt(searchParams.pageSize || "20");

  const { doctors, total, totalPages, currentPage } = await getDoctors({
    search: searchParams.search,
    status: searchParams.status || "active",
    clinicId: searchParams.clinicId,
    specialty: searchParams.specialty,
    page,
    pageSize,
  });

  // Get clinics for filter (only for ADMIN)
  const clinics = session.user.role === "ADMIN" ? await getClinics() : [];

  // Get all available specialties
  const specialties = await getDoctorSpecialties();

  const canManage = Permissions.canManageDoctors(session.user);

  return (
    <div className="space-y-6">
      <Header
        title="Doctors"
        description={
          canManage
            ? "Manage doctors and their schedules"
            : "View active doctors"
        }
      />
      <DoctorsTable
        doctors={doctors}
        canManage={canManage}
        total={total}
        totalPages={totalPages}
        currentPage={currentPage}
        clinics={clinics}
        specialties={specialties}
      />
    </div>
  );
}
