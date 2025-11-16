import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Marcar como ruta dinámica
export const dynamic = "force-dynamic";

const profileSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  secondLastName: z.string().optional(),
  noSecondLastName: z.boolean().default(false),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo puede editar su propio perfil
    if (session.user.id !== params.userId) {
      return NextResponse.json(
        { error: "No tienes permiso para editar este perfil" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = profileSchema.parse(body);

    // Si no tiene segundo apellido, limpiarlo
    const updateData = {
      ...validatedData,
      secondLastName: validatedData.noSecondLastName
        ? null
        : validatedData.secondLastName,
    };

    const updatedUser = await prisma.user.update({
      where: { id: params.userId },
      data: updateData,
    });

    return NextResponse.json({
      message: "Perfil actualizado correctamente",
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        secondLastName: updatedUser.secondLastName,
        noSecondLastName: updatedUser.noSecondLastName,
        phone: updatedUser.phone,
        address: updatedUser.address,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error al actualizar perfil:", error);
    return NextResponse.json(
      { error: "Error al actualizar el perfil" },
      { status: 500 }
    );
  }
}
