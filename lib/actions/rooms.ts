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
export async function getAllRooms(params?: {
  clinicId?: string;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const {
    clinicId = "all",
    search = "",
    status = "active",
    page = 1,
    pageSize = 20,
  } = params || {};

  // Build where clause
  const whereClause: any = {};

  // Status filter
  if (status === "active") {
    whereClause.isActive = true;
  } else if (status === "inactive") {
    whereClause.isActive = false;
  }

  // Clinic filter
  if (session.user.role === "ADMIN") {
    if (clinicId !== "all") {
      whereClause.clinicId = clinicId;
    }
  } else {
    // Non-admin users only see rooms from their clinic
    whereClause.clinicId = session.user.clinicId || "";
  }

  // Search filter
  if (search) {
    whereClause.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
    ];
  }

  // Get total count
  const total = await prisma.room.count({
    where: whereClause,
  });

  // Calculate pagination
  const totalPages = Math.ceil(total / pageSize);
  const skip = (page - 1) * pageSize;

  // Get rooms with pagination
  const rooms = await prisma.room.findMany({
    where: whereClause,
    include: { clinic: true },
    orderBy: [
      { clinic: { name: "asc" } },
      { isActive: "desc" },
      { name: "asc" },
    ],
    skip,
    take: pageSize,
  });

  // Get clinics (only for ADMIN)
  const clinics =
    session.user.role === "ADMIN"
      ? await prisma.clinic.findMany({ orderBy: { name: "asc" } })
      : [];

  return {
    rooms,
    clinics,
    total,
    totalPages,
    currentPage: page,
  };
}
