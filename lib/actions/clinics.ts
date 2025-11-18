"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Permissions } from "@/lib/permissions";

const createClinicSchema = z.object({
  name: z.string().min(1, "Por favor ingresa el nombre de la clínica"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .string()
    .email("Por favor ingresa un correo electrónico válido")
    .optional()
    .or(z.literal("")),
  timezone: z.string().default("America/Mexico_City"),
  locale: z.string().default("es-MX"),
  defaultSlotMinutes: z
    .number()
    .min(5, "Los minutos por turno deben ser al menos 5")
    .max(120, "Los minutos por turno no pueden ser más de 120")
    .default(30),
  clinicAcronym: z
    .string()
    .min(1, "Por favor ingresa el acrónimo de la clínica")
    .max(5, "El acrónimo debe tener máximo 5 caracteres")
    .default(""),
});

export async function createClinic(data: z.infer<typeof createClinicSchema>) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canCreateClinics(session.user)) {
    throw new Error("Solo los administradores pueden crear clínicas");
  }

  const validatedData = createClinicSchema.parse(data);

  const clinic = await prisma.clinic.create({
    data: {
      name: validatedData.name,
      address: validatedData.address,
      phone: validatedData.phone,
      email: validatedData.email || null,
      timezone: validatedData.timezone,
      locale: validatedData.locale,
      defaultSlotMinutes: validatedData.defaultSlotMinutes,
      clinicAcronym: validatedData.clinicAcronym,
    },
  });

  revalidatePath("/clinics");
  return clinic;
}

export async function updateClinic(
  id: string,
  data: z.infer<typeof createClinicSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageClinics(session.user)) {
    throw new Error("No tienes permisos para actualizar clínicas");
  }

  // CLINIC_ADMIN can only edit their own clinic
  if (!Permissions.canAccessClinic(session.user, id)) {
    throw new Error("Solo puedes editar tu propia clínica");
  }

  const validatedData = createClinicSchema.parse(data);

  const clinic = await prisma.clinic.update({
    where: { id },
    data: {
      name: validatedData.name,
      address: validatedData.address,
      phone: validatedData.phone,
      email: validatedData.email || null,
      timezone: validatedData.timezone,
      locale: validatedData.locale,
      defaultSlotMinutes: validatedData.defaultSlotMinutes,
      clinicAcronym: validatedData.clinicAcronym,
    },
  });

  revalidatePath("/clinics");
  return clinic;
}

export async function deleteClinic(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageClinics(session.user)) {
    throw new Error("No tienes permisos para eliminar clínicas");
  }

  // CLINIC_ADMIN cannot delete clinics
  if (session.user.role !== "ADMIN") {
    throw new Error("Solo los administradores pueden eliminar clínicas");
  }

  await prisma.clinic.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  revalidatePath("/clinics");
}

export async function setClinicActive(id: string, isActive: boolean) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageClinics(session.user)) {
    throw new Error("No tienes permisos para cambiar el estado de clínicas");
  }

  // CLINIC_ADMIN cannot change clinic status
  if (session.user.role !== "ADMIN") {
    throw new Error(
      "Solo los administradores pueden cambiar el estado de una clínica"
    );
  }

  const data: any = { isActive };
  if (!isActive) {
    data.deletedAt = new Date();
  } else {
    data.deletedAt = null;
  }

  const clinic = await prisma.clinic.update({
    where: { id },
    data,
  });

  revalidatePath("/clinics");
  return clinic;
}

export async function getClinics(params?: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("No tienes permisos para realizar esta acción");
  }

  // Allow users who can manage clinics OR manage appointments to view clinics
  if (
    !Permissions.canManageClinics(session.user) &&
    !Permissions.canManageAppointments(session.user)
  ) {
    throw new Error("No tienes permisos para ver clínicas");
  }

  const { search = "", status = "all", page = 1, pageSize = 20 } = params || {};

  // Build where clause
  const whereClause: any = {};

  // Status filter
  if (status === "active") {
    whereClause.isActive = true;
  } else if (status === "inactive") {
    whereClause.isActive = false;
  }

  // For non-admin users, restrict to their clinic
  if (session.user.role !== "ADMIN" && session.user.clinicId) {
    whereClause.id = session.user.clinicId;
  }

  // Search filter
  if (search) {
    whereClause.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  // Get total count
  const total = await prisma.clinic.count({
    where: whereClause,
  });

  // Calculate pagination
  const totalPages = Math.ceil(total / pageSize);
  const skip = (page - 1) * pageSize;

  // Get clinics with pagination
  const clinics = await prisma.clinic.findMany({
    where: whereClause,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    skip,
    take: pageSize,
  });

  return {
    clinics,
    total,
    totalPages,
    currentPage: page,
  };
}
