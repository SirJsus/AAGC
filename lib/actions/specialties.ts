"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Obtener todas las especialidades activas
 */
export async function getActiveSpecialties() {
  try {
    const specialties = await prisma.specialty.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: specialties };
  } catch (error) {
    console.error("Error fetching specialties:", error);
    return { success: false, error: "Error al obtener especialidades" };
  }
}

/**
 * Crear una nueva especialidad
 */
export async function createSpecialty(data: {
  name: string;
  description?: string;
}) {
  try {
    const specialty = await prisma.specialty.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });
    revalidatePath("/dashboard/doctors");
    return { success: true, data: specialty };
  } catch (error) {
    console.error("Error creating specialty:", error);
    return { success: false, error: "Error al crear especialidad" };
  }
}

/**
 * Actualizar especialidades de un doctor
 */
export async function updateDoctorSpecialties(
  doctorId: string,
  specialtyIds: string[],
  primarySpecialtyId?: string
) {
  try {
    // Eliminar especialidades existentes
    await prisma.doctorSpecialty.deleteMany({
      where: { doctorId },
    });

    // Si no hay especialidades, solo retornar
    if (specialtyIds.length === 0) {
      revalidatePath("/dashboard/doctors");
      return { success: true, data: [] };
    }

    // Crear nuevas asignaciones
    const assignments = specialtyIds.map((specialtyId) => ({
      doctorId,
      specialtyId,
      isPrimary:
        specialtyId === primarySpecialtyId || specialtyId === specialtyIds[0],
    }));

    await prisma.doctorSpecialty.createMany({
      data: assignments,
    });

    // Obtener especialidades actualizadas
    const doctorSpecialties = await prisma.doctorSpecialty.findMany({
      where: { doctorId },
      include: { specialty: true },
      orderBy: { isPrimary: "desc" },
    });

    revalidatePath("/dashboard/doctors");
    return { success: true, data: doctorSpecialties };
  } catch (error) {
    console.error("Error updating doctor specialties:", error);
    return {
      success: false,
      error: "Error al actualizar especialidades del doctor",
    };
  }
}

/**
 * Obtener especialidades de un doctor
 */
export async function getDoctorSpecialties(doctorId: string) {
  try {
    const specialties = await prisma.doctorSpecialty.findMany({
      where: { doctorId },
      include: { specialty: true },
      orderBy: { isPrimary: "desc" },
    });
    return { success: true, data: specialties };
  } catch (error) {
    console.error("Error fetching doctor specialties:", error);
    return {
      success: false,
      error: "Error al obtener especialidades del doctor",
    };
  }
}

/**
 * Buscar doctores por especialidad
 */
export async function getDoctorsBySpecialty(
  specialtyId: string,
  clinicId?: string
) {
  try {
    const doctors = await prisma.doctor.findMany({
      where: {
        specialties: {
          some: {
            specialtyId,
          },
        },
        isActive: true,
        ...(clinicId && { clinicId }),
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            secondLastName: true,
            email: true,
            phone: true,
          },
        },
        specialties: {
          include: {
            specialty: true,
          },
          orderBy: {
            isPrimary: "desc",
          },
        },
      },
    });
    return { success: true, data: doctors };
  } catch (error) {
    console.error("Error fetching doctors by specialty:", error);
    return {
      success: false,
      error: "Error al buscar doctores por especialidad",
    };
  }
}

/**
 * Marcar una especialidad como principal para un doctor
 */
export async function setPrimarySpecialty(
  doctorId: string,
  specialtyId: string
) {
  try {
    // Primero, quitar la marca de principal de todas las especialidades del doctor
    await prisma.doctorSpecialty.updateMany({
      where: { doctorId },
      data: { isPrimary: false },
    });

    // Marcar la especialidad seleccionada como principal
    const updated = await prisma.doctorSpecialty.updateMany({
      where: {
        doctorId,
        specialtyId,
      },
      data: { isPrimary: true },
    });

    revalidatePath("/dashboard/doctors");
    return { success: true, data: updated };
  } catch (error) {
    console.error("Error setting primary specialty:", error);
    return {
      success: false,
      error: "Error al establecer especialidad principal",
    };
  }
}

/**
 * Eliminar una especialidad de un doctor
 */
export async function removeDoctorSpecialty(
  doctorId: string,
  specialtyId: string
) {
  try {
    await prisma.doctorSpecialty.deleteMany({
      where: {
        doctorId,
        specialtyId,
      },
    });

    revalidatePath("/dashboard/doctors");
    return { success: true };
  } catch (error) {
    console.error("Error removing doctor specialty:", error);
    return {
      success: false,
      error: "Error al eliminar especialidad del doctor",
    };
  }
}
