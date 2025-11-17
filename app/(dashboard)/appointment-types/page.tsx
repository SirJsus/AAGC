import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Permissions } from "@/lib/permissions";
import { AppointmentTypesClient } from "./appointment-types-client";
import { getAppointmentTypes } from "@/lib/actions/appointment-types";

export const dynamic = "force-dynamic";

interface AppointmentTypesPageProps {
  searchParams: {
    search?: string;
    status?: string;
    clinicId?: string;
    page?: string;
    pageSize?: string;
  };
}

export default async function AppointmentTypesPage({
  searchParams,
}: AppointmentTypesPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewAppointmentTypes(session.user)) {
    redirect("/dashboard");
  }

  const canManage = Permissions.canManageAppointmentTypes(session.user);

  const page = parseInt(searchParams.page || "1");
  const pageSize = parseInt(searchParams.pageSize || "20");

  const { appointmentTypes, total, totalPages, currentPage } =
    await getAppointmentTypes({
      search: searchParams.search,
      status: searchParams.status || "active",
      clinicId: searchParams.clinicId,
      page,
      pageSize,
    });

  // Get all clinics for admin users
  const clinics = await prisma.clinic.findMany({
    where: {
      isActive: true,
      deletedAt: null,
    },
    orderBy: {
      name: "asc",
    },
  });

  // Convert Decimal to number for client compatibility
  const serializedAppointmentTypes = appointmentTypes.map((type) => ({
    ...type,
    createdAt: type.createdAt.toISOString(),
    updatedAt: type.updatedAt.toISOString(),
    deletedAt: type.deletedAt?.toISOString() || null,
    clinic: type.clinic
      ? {
          ...type.clinic,
          createdAt: type.clinic.createdAt.toISOString(),
          updatedAt: type.clinic.updatedAt.toISOString(),
          deletedAt: type.clinic.deletedAt?.toISOString() || null,
          patientAcronym: type.clinic.clinicAcronym ?? "",
        }
      : null,
  }));
  const serializedClinics = clinics.map((clinic) => ({
    ...clinic,
    createdAt: clinic.createdAt.toISOString(),
    updatedAt: clinic.updatedAt.toISOString(),
    deletedAt: clinic.deletedAt?.toISOString() || null,
    patientAcronym: clinic.clinicAcronym ?? "",
  }));

  return (
    <AppointmentTypesClient
      appointmentTypes={serializedAppointmentTypes}
      clinics={serializedClinics}
      userRole={session.user.role}
      userClinicId={session.user.clinicId || undefined}
      canManage={canManage}
      total={total}
      totalPages={totalPages}
      currentPage={currentPage}
    />
  );
}
