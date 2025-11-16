import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Marcar como ruta dinámica
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo los admins pueden ver todas las clínicas
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No tienes permiso para ver todas las clínicas" },
        { status: 403 }
      );
    }

    const clinics = await prisma.clinic.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        clinicAcronym: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(clinics);
  } catch (error) {
    console.error("Error fetching clinics:", error);
    return NextResponse.json(
      { error: "Error al obtener las clínicas" },
      { status: 500 }
    );
  }
}
