"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Permissions } from "@/lib/permissions";

const createRoomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  clinicId: z.string().min(1, "Clinic is required"),
  location: z.string().optional(),
  capacity: z.number().min(1).default(1),
  isActive: z.boolean().optional().default(true),
});

export async function createRoom(data: z.infer<typeof createRoomSchema>) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageRooms(session.user)) {
    throw new Error("Unauthorized");
  }

  const validatedData = createRoomSchema.parse(data);

  // Validate clinic access
  if (!Permissions.canAccessClinic(session.user, validatedData.clinicId)) {
    throw new Error("Cannot create room in this clinic");
  }

  const room = await prisma.room.create({
    data: validatedData,
    include: {
      clinic: true,
    },
  });

  revalidatePath("/rooms");
  return room;
}

export async function updateRoom(
  id: string,
  data: z.infer<typeof createRoomSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageRooms(session.user)) {
    throw new Error("Unauthorized");
  }

  const validatedData = createRoomSchema.parse(data);

  if (!Permissions.canAccessClinic(session.user, validatedData.clinicId)) {
    throw new Error("Cannot update room in this clinic");
  }

  const room = await prisma.room.update({
    where: { id },
    data: validatedData,
    include: {
      clinic: true,
    },
  });

  revalidatePath("/rooms");
  return room;
}

export async function deleteRoom(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageRooms(session.user)) {
    throw new Error("Unauthorized");
  }

  await prisma.room.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  revalidatePath("/rooms");
}

export async function getRooms() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const whereClause =
    session.user.role === "ADMIN"
      ? { isActive: true }
      : {
          isActive: true,
          clinicId: session.user.clinicId || "",
        };

  return prisma.room.findMany({
    where: whereClause,
    include: {
      clinic: true,
    },
    orderBy: [
      { clinic: { name: "asc" } },
      { isActive: "desc" },
      { name: "asc" },
    ],
  });
}

// New: return all rooms (active + inactive) for user's clinic, or for ADMIN return all rooms
export async function getAllRooms(opts?: { clinicId?: string }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  // Admin: can optionally filter by clinicId
  if (session.user.role === "ADMIN") {
    const whereClause = opts?.clinicId ? { clinicId: opts.clinicId } : {};

    const rooms = await prisma.room.findMany({
      where: whereClause,
      include: { clinic: true },
      orderBy: [
        { clinic: { name: "asc" } },
        { isActive: "desc" },
        { name: "asc" },
      ],
    });

    const clinics = await prisma.clinic.findMany({ orderBy: { name: "asc" } });

    return { rooms, clinics };
  }

  // Non-admin: return all rooms for the user's clinic (active and inactive)
  const clinicId = session.user.clinicId || "";

  const rooms = await prisma.room.findMany({
    where: { clinicId },
    include: { clinic: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return { rooms, clinics: [] };
}
