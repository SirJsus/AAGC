import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function checkAndSeed() {
  try {
    console.log("🔍 Checking if database needs seeding...");

    // Verificar si existen usuarios en la base de datos
    const userCount = await prisma.user.count();

    if (userCount === 0) {
      console.log("🌱 Database is empty. Running seed...");

      // Ejecutar el seed usando npm run
      const { stdout, stderr } = await execAsync("npm run db:seed");

      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);

      console.log("✅ Seed completed successfully!");
    } else {
      console.log(
        `✅ Database already has ${userCount} user(s). Skipping seed.`
      );
    }
  } catch (error) {
    console.error("❌ Error during seed check:", error);
    // No lanzar error para no romper el build
    console.log("⚠️  Continuing without seed...");
  } finally {
    await prisma.$disconnect();
  }
}

checkAndSeed();
