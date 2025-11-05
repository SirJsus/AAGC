import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  const adminUsername = process.env.ADMIN_USER;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminPhone = process.env.ADMIN_PHONE;

  if (!adminPassword || !adminUsername || !adminPhone) {
    console.error("Error: La variable de entorno no está definida.");
    console.error("Verificar el archivo .env");
    process.exit(1);
  }

  // 1. Create Admin User
  console.log("Creating admin user...");
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  // Admin user
  const adminUser = await prisma.user.upsert({
    where: { email: adminUsername },
    update: {},
    create: {
      email: adminUsername,
      password: hashedPassword,
      firstName: "",
      lastName: "",
      secondLastName: "",
      role: Role.ADMIN,
      clinicId: null, // Admin is global
      phone: adminPhone,
      address: "Ciudad de México, México",
      dateOfBirth: new Date("1985-01-01"),
    },
  });

  console.log("Seed completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
