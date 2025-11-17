import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { UserCreateDialog } from "@/components/users/user-create-dialog";
import { UsersTable } from "@/components/users/users-table";
import { getUsers } from "@/lib/actions/users";

export const dynamic = "force-dynamic";

interface UsersPageProps {
  searchParams: {
    search?: string;
    role?: string;
    status?: string;
    clinicId?: string;
    page?: string;
    pageSize?: string;
  };
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN and CLINIC_ADMIN can view users
  if (session.user.role !== "ADMIN" && session.user.role !== "CLINIC_ADMIN") {
    redirect("/dashboard");
  }

  const page = parseInt(searchParams.page || "1");
  const pageSize = parseInt(searchParams.pageSize || "20");

  const { users, total, totalPages, currentPage } = await getUsers({
    search: searchParams.search,
    role: searchParams.role,
    status: searchParams.status || "all",
    clinicId: searchParams.clinicId,
    page,
    pageSize,
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
            total={total}
            totalPages={totalPages}
            currentPage={currentPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
