import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { UserCreateDialog } from "@/components/users/user-create-dialog";
import { UsersTable } from "@/components/users/users-table";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN and CLINIC_ADMIN can view users
  if (session.user.role !== "ADMIN" && session.user.role !== "CLINIC_ADMIN") {
    redirect("/dashboard");
  }

  // Get users based on role
  const whereClause =
    session.user.role === "ADMIN"
      ? { deletedAt: null }
      : {
          clinicId: session.user.clinicId || "",
          deletedAt: null,
        };

  const users = await prisma.user.findMany({
    where: whereClause,
    include: {
      clinic: true,
      doctor: {
        select: {
          acronym: true,
          roomId: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
  });

  // Get clinics for the dropdown
  const clinicsWhereClause =
    session.user.role === "ADMIN"
      ? { isActive: true }
      : { id: session.user.clinicId || "", isActive: true };

  const clinics = await prisma.clinic.findMany({
    where: clinicsWhereClause,
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Get rooms for doctor assignment
  const roomsWhereClause =
    session.user.role === "ADMIN"
      ? { isActive: true }
      : { clinicId: session.user.clinicId || "", isActive: true };

  const rooms = await prisma.room.findMany({
    where: roomsWhereClause,
    select: {
      id: true,
      name: true,
      clinicId: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Header
          title="Gestión de Usuarios"
          description="Administrar usuarios del sistema y sus roles"
        />
        <UserCreateDialog
          clinics={clinics}
          rooms={rooms}
          currentUserRole={session.user.role}
          currentUserClinicId={session.user.clinicId}
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <UsersTable
            users={users}
            clinics={clinics}
            rooms={rooms}
            currentUserRole={session.user.role}
            currentUserClinicId={session.user.clinicId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
