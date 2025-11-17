import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Permissions } from "@/lib/permissions";
import { Header } from "@/components/layout/header";
import { getAllRooms } from "@/lib/actions/rooms";
import { RoomsTable } from "@/components/rooms/rooms-table";

export const dynamic = "force-dynamic";

interface RoomsPageProps {
  searchParams: {
    search?: string;
    status?: string;
    clinicId?: string;
    page?: string;
    pageSize?: string;
  };
}

export default async function RoomsPage({ searchParams }: RoomsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewRooms(session.user)) {
    redirect("/dashboard");
  }

  const page = parseInt(searchParams.page || "1");
  const pageSize = parseInt(searchParams.pageSize || "20");

  const { rooms, clinics, total, totalPages, currentPage } = await getAllRooms({
    search: searchParams.search,
    status: searchParams.status || "active",
    clinicId: searchParams.clinicId,
    page,
    pageSize,
  });

  const canManage = Permissions.canManageRooms(session.user);

  return (
    <div className="space-y-6">
      <Header
        title="Rooms"
        description={
          canManage
            ? "Manage consultation rooms and facilities"
            : "View consultation rooms"
        }
      />
      <RoomsTable
        rooms={rooms}
        clinics={clinics}
        canManage={canManage}
        total={total}
        totalPages={totalPages}
        currentPage={currentPage}
      />
    </div>
  );
}
