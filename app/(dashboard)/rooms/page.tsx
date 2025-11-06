import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Permissions } from "@/lib/permissions";
import { Header } from "@/components/layout/header";
import { getAllRooms } from "@/lib/actions/rooms";
import { RoomsTable } from "@/components/rooms/rooms-table";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewRooms(session.user)) {
    redirect("/dashboard");
  }

  const { rooms, clinics } = await getAllRooms();
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
      <RoomsTable rooms={rooms} clinics={clinics} canManage={canManage} />
    </div>
  );
}
