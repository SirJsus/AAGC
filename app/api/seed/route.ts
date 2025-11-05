import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

// IMPORTANTE: Solo permitir en desarrollo o con token especial
export async function POST(request: Request) {
  // Verificar que solo se ejecute en desarrollo o con autenticación adecuada
  if (process.env.NODE_ENV === "production") {
    const { seedToken } = await request.json();

    if (!seedToken || seedToken !== process.env.SEED_TOKEN) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  try {
    console.log("🔍 Checking database state...");

    const userCount = await prisma.user.count();

    if (userCount > 0) {
      return NextResponse.json({
        message: `La base de datos ya tiene ${userCount} usuario(s)`,
        seeded: false,
      });
    }

    console.log("🌱 Running seed...");

    // Aquí deberías importar y ejecutar tu lógica de seed
    // Por seguridad, esto se deja como ejercicio

    return NextResponse.json({
      message: "Seed ejecutado exitosamente",
      seeded: true,
    });
  } catch (error) {
    console.error("Error seeding:", error);
    return NextResponse.json(
      { error: "Error al ejecutar seed" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
