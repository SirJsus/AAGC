import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Permissions } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !Permissions.canEditPatientCustomId(session.user)) {
      return NextResponse.json(
        { error: "No tienes permisos para verificar IDs de pacientes" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { customId, patientId } = body;

    if (!customId) {
      return NextResponse.json(
        { error: "El ID personalizado es requerido" },
        { status: 400 }
      );
    }

    // Verificar si existe otro paciente con este customId
    const existingPatient = await prisma.patient.findFirst({
      where: {
        customId: customId,
        ...(patientId && {
          NOT: {
            id: patientId, // Excluir el paciente actual
          },
        }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        customId: true,
      },
    });

    if (existingPatient) {
      return NextResponse.json({
        available: false,
        message: `El ID "${customId}" ya está en uso`,
        existingPatient: {
          id: existingPatient.id,
          name: `${existingPatient.firstName} ${existingPatient.lastName}`,
        },
      });
    }

    return NextResponse.json({
      available: true,
      message: `El ID "${customId}" está disponible`,
    });
  } catch (error) {
    console.error("Error verifying custom ID:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al verificar el ID personalizado",
      },
      { status: 500 }
    );
  }
}
