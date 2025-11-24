import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const clinicId = searchParams.get("clinicId");

    // Construir filtros
    const where: any = {
      isActive: true,
      deletedAt: null,
    };

    // Filtro por clínica
    if (session.user.role === "ADMIN") {
      // Si es ADMIN y especifica una clínica, filtrar por esa
      if (clinicId && clinicId !== "all") {
        where.clinicId = clinicId;
      }
      // Si no especifica clínica, mostrar todos los tipos
    } else {
      // Si no es ADMIN, solo mostrar tipos de su clínica
      if (session.user.clinicId) {
        where.clinicId = session.user.clinicId;
      }
    }

    const appointmentTypes = await prisma.appointmentType.findMany({
      where,
      select: {
        id: true,
        name: true,
        price: true,
        durationMin: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(appointmentTypes);
  } catch (error) {
    console.error("Error fetching appointment types:", error);
    return NextResponse.json(
      { error: "Error al obtener los tipos de cita" },
      { status: 500 }
    );
  }
}
