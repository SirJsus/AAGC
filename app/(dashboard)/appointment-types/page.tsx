import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Permissions } from "@/lib/permissions";
import { AppointmentTypesClient } from "./appointment-types-client";

export const dynamic = "force-dynamic";

export default async function AppointmentTypesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewAppointmentTypes(session.user)) {
    redirect("/dashboard");
  }

  const canManage = Permissions.canManageAppointmentTypes(session.user);

  // Get appointment types based on role
  const whereClause =
    session.user.role === "ADMIN"
      ? { deletedAt: null, isActive: true }
      : {
          clinicId: session.user.clinicId || "",
          deletedAt: null,
          isActive: true,
        };

  const appointmentTypes = await prisma.appointmentType.findMany({
    where: whereClause,
    include: {
      clinic: true,
    },
    orderBy: {
      name: "asc",
    },
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
    price: type.price.toNumber(),
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
    />
  );
}
