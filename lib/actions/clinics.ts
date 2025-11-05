"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Permissions } from "@/lib/permissions";

const createClinicSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  timezone: z.string().default("America/Mexico_City"),
  locale: z.string().default("es-MX"),
  defaultSlotMinutes: z.number().min(5).max(120).default(30),
  clinicAcronym: z.string().min(1).max(5).default(""),
});

export async function createClinic(data: z.infer<typeof createClinicSchema>) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManageClinics(session.user)) {
    throw new Error("Unauthorized");
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
    throw new Error("Unauthorized");
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
    throw new Error("Unauthorized");
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
    throw new Error("Unauthorized");
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

export async function getClinics() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (Permissions.canManageClinics(session.user)) {
    // Admins: return all clinics, ordering active ones first, then by name
    return prisma.clinic.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  } else {
    // Non-admin: return only the clinic associated with the user (even if inactive)
    return prisma.clinic.findMany({
      where: {
        id: session.user.clinicId || "",
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  }
}
