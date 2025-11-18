"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Permissions } from "@/lib/permissions";

const createRoomSchema = z.object({
  name: z.string().min(1, "Por favor ingresa el nombre del consultorio"),
  clinicId: z.string().min(1, "Por favor selecciona una clínica"),
  location: z.string().optional(),
  capacity: z.number().min(1, "La capacidad debe ser al menos 1").default(1),
  isActive: z.boolean().optional().default(true),
});

export async function createRoom(data: z.infer<typeof createRoomSchema>) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageRooms(session.user)) {
    throw new Error("No tienes permisos para crear consultorios");
  }

  const validatedData = createRoomSchema.parse(data);

  // Validate clinic access
  if (!Permissions.canAccessClinic(session.user, validatedData.clinicId)) {
    throw new Error("No tienes acceso a esta clínica para crear consultorios");
  }

  // Validate clinic exists and is active
  const clinic = await prisma.clinic.findUnique({
    where: { id: validatedData.clinicId },
    select: { isActive: true, deletedAt: true },
  });

  if (!clinic || !clinic.isActive || clinic.deletedAt) {
    throw new Error("La clínica seleccionada no está disponible");
  }

  // Check for duplicate room name in the same clinic
  const duplicateName = await prisma.room.findFirst({
    where: {
      clinicId: validatedData.clinicId,
      name: validatedData.name,
      isActive: true,
      deletedAt: null,
    },
  });

  if (duplicateName) {
    throw new Error(
      `Ya existe un consultorio con el nombre "${validatedData.name}" en esta clínica`
    );
  }

  try {
    const room = await prisma.room.create({
      data: validatedData,
      include: {
        clinic: true,
      },
    });

    revalidatePath("/rooms");
    return room;
  } catch (error) {
    console.error("Error creating room:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      "No se pudo crear el consultorio. Por favor intenta nuevamente"
    );
  }
}

export async function updateRoom(
  id: string,
  data: z.infer<typeof createRoomSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageRooms(session.user)) {
    throw new Error("No tienes permisos para modificar consultorios");
  }

  const validatedData = createRoomSchema.parse(data);

  if (!Permissions.canAccessClinic(session.user, validatedData.clinicId)) {
    throw new Error(
      "No tienes acceso a esta clínica para modificar consultorios"
    );
  }

  // Validate room exists
  const existingRoom = await prisma.room.findUnique({
    where: { id },
    select: { id: true, isActive: true, deletedAt: true },
  });

  if (!existingRoom) {
    throw new Error("No se encontró el consultorio solicitado");
  }

  if (!existingRoom.isActive || existingRoom.deletedAt) {
    throw new Error(
      "No se puede modificar un consultorio que ha sido eliminado"
    );
  }

  // Validate clinic exists and is active
  const clinic = await prisma.clinic.findUnique({
    where: { id: validatedData.clinicId },
    select: { isActive: true, deletedAt: true },
  });

  if (!clinic || !clinic.isActive || clinic.deletedAt) {
    throw new Error("La clínica seleccionada no está disponible");
  }

  // Check for duplicate room name in the same clinic (excluding current room)
  const duplicateName = await prisma.room.findFirst({
    where: {
      clinicId: validatedData.clinicId,
      name: validatedData.name,
      isActive: true,
      deletedAt: null,
      id: { not: id },
    },
  });

  if (duplicateName) {
    throw new Error(
      `Ya existe un consultorio con el nombre "${validatedData.name}" en esta clínica`
    );
  }

  try {
    const room = await prisma.room.update({
      where: { id },
      data: validatedData,
      include: {
        clinic: true,
      },
    });

    revalidatePath("/rooms");
    return room;
  } catch (error) {
    console.error("Error updating room:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      "No se pudo actualizar el consultorio. Por favor intenta nuevamente"
    );
  }
}

export async function deleteRoom(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageRooms(session.user)) {
    throw new Error("No tienes permisos para eliminar consultorios");
  }

  // Validate room exists
  const room = await prisma.room.findUnique({
    where: { id },
    select: { id: true, isActive: true, deletedAt: true },
  });

  if (!room) {
    throw new Error("No se encontró el consultorio solicitado");
  }

  if (!room.isActive || room.deletedAt) {
    throw new Error("Este consultorio ya ha sido eliminado");
  }

  // Check for active appointments
  const activeAppointments = await prisma.appointment.count({
    where: {
      roomId: id,
      isActive: true,
      date: {
        gte: new Date().toISOString().split("T")[0],
      },
    },
  });

  if (activeAppointments > 0) {
    throw new Error(
      `No se puede eliminar el consultorio porque tiene ${activeAppointments} cita(s) activa(s) pendiente(s). Por favor cancela o reasigna las citas primero`
    );
  }

  // Check for doctors assigned to this room
  const assignedDoctors = await prisma.doctor.count({
    where: {
      roomId: id,
      isActive: true,
      deletedAt: null,
    },
  });

  if (assignedDoctors > 0) {
    throw new Error(
      `No se puede eliminar el consultorio porque tiene ${assignedDoctors} doctor(es) asignado(s). Por favor reasigna los doctores primero`
    );
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
    throw new Error("No tienes permisos para ver los consultorios");
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
    throw new Error("No tienes permisos para ver los consultorios");
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
