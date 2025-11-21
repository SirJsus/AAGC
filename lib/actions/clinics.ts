"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Permissions } from "@/lib/permissions";

// Helper function to remove accents from strings
function removeAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

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

  // Get all clinics matching base filters (without search initially)
  const allClinics = await prisma.clinic.findMany({
    where: whereClause,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  // Apply flexible search filter if search term is provided
  let filteredClinics = allClinics;
  if (search) {
    // Normalize query: remove accents and convert to uppercase
    const normalizedQuery = removeAccents(search.trim());

    // Split query into words for flexible matching
    const queryWords = normalizedQuery
      .split(/\s+/)
      .filter((word) => word.length > 0);

    // Filter clinics by checking if all query words appear in searchable fields
    filteredClinics = allClinics.filter((clinic) => {
      const name = removeAccents(clinic.name || "");
      const address = removeAccents(clinic.address || "");
      const phone = removeAccents(clinic.phone || "");
      const email = removeAccents(clinic.email || "");

      // Check if all query words appear somewhere in the searchable fields
      return queryWords.every((word) => {
        return (
          name.includes(word) ||
          address.includes(word) ||
          phone.includes(word) ||
          email.includes(word)
        );
      });
    });
  }

  // Get total count after filtering
  const total = filteredClinics.length;

  // Calculate pagination
  const totalPages = Math.ceil(total / pageSize);
  const skip = (page - 1) * pageSize;

  // Apply pagination
  const clinics = filteredClinics.slice(skip, skip + pageSize);

  return {
    clinics,
    total,
    totalPages,
    currentPage: page,
  };
}
