import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Permissions } from "@/lib/permissions";
import { Header } from "@/components/layout/header";
import { getPatients } from "@/lib/actions/patients";
import { PatientsTable } from "@/components/patients/patients-table";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PatientsPageProps {
  searchParams: {
    page?: string;
    pageSize?: string;
    search?: string;
    status?: "active" | "inactive" | "all";
    gender?: string;
    doctorId?: string;
    clinicId?: string;
    pendingCompletion?: string;
  };
}

export default async function PatientsPage({
  searchParams,
}: PatientsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewPatients(session.user)) {
    redirect("/dashboard");
  }

  const page = parseInt(searchParams.page || "1");
  const pageSize = parseInt(searchParams.pageSize || "20");
  const search = searchParams.search || "";
  const status = searchParams.status || "active";
  const gender = searchParams.gender || "all";
  const doctorId = searchParams.doctorId || "all";
  const clinicId = searchParams.clinicId || "all";
  const pendingCompletion =
    searchParams.pendingCompletion === "true"
      ? true
      : searchParams.pendingCompletion === "false"
        ? false
        : "all";

  const { patients, total, totalPages, currentPage } = await getPatients({
    page,
    pageSize,
    search,
    status: status as any,
    gender: gender as any,
    doctorId,
    clinicId,
    pendingCompletion: pendingCompletion as any,
  });

  // Get doctors for filter dropdown
  const whereClause =
    session.user.role === "ADMIN"
      ? {}
      : { clinicId: session.user.clinicId || "" };

  const doctors = await prisma.doctor.findMany({
    where: {
      ...whereClause,
      isActive: true,
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
  });

  // Get clinics for filter dropdown (only for ADMIN)
  const clinics = await prisma.clinic.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const canEdit = Permissions.canEditPatients(session.user);

  return (
    <div className="space-y-6">
      <Header
        title="Patients"
        description={
          canEdit
            ? "Manage patient records and information"
            : "View patient records and information"
        }
      />
      <PatientsTable
        patients={patients}
        canEdit={canEdit}
        total={total}
        totalPages={totalPages}
        currentPage={currentPage}
        doctors={doctors}
        clinics={clinics}
      />
    </div>
  );
}
