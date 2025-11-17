import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

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
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 12);
  const hashedPassword = await bcrypt.hash("MiClave123!", 12);

  // Admin user
  const adminUser = await prisma.user.upsert({
    where: { email: adminUsername },
    update: {},
    create: {
      email: adminUsername,
      password: hashedAdminPassword,
      firstName: "Admin",
      lastName: "Sistema",
      secondLastName: "",
      role: Role.ADMIN,
      clinicId: null, // Admin is global
      phone: adminPhone,
      address: "Ciudad de México, México",
      dateOfBirth: new Date("1985-01-01"),
    },
  });

  console.log("Admin user created");

  // 2. Create Clinic
  console.log("Creating clinic...");
  const clinic = await prisma.clinic.upsert({
    where: { clinicAcronym: "GCD" },
    update: {},
    create: {
      name: "Global Cardio",
      address:
        "Hospital Angeles Lomas, Edificio de Especialidades, Clínica 1245, Vialidad de la Barranca s/n, Hacienda de las Palmas, 52763 Jesús del Monte, Méx.",
      phone: "55 5246 9800",
      email: "contacto@globalcardio.com",
      timezone: "America/Mexico_City",
      locale: "es-MX",
      defaultSlotMinutes: 30,
      clinicAcronym: "GCD",
      isActive: true,
    },
  });

  console.log("Clinic created:", clinic.name);

  // 3. Create Clinic Schedule (Monday to Friday, 10:00 - 20:00)
  console.log("Creating clinic schedule...");
  const scheduleData = [
    { weekday: 1, day: "Lunes" }, // Monday
    { weekday: 2, day: "Martes" }, // Tuesday
    { weekday: 3, day: "Miércoles" }, // Wednesday
    { weekday: 4, day: "Jueves" }, // Thursday
    { weekday: 5, day: "Viernes" }, // Friday
  ];

  for (const schedule of scheduleData) {
    await prisma.clinicSchedule.upsert({
      where: {
        clinicId_weekday_startTime_endTime: {
          clinicId: clinic.id,
          weekday: schedule.weekday,
          startTime: "10:00",
          endTime: "20:00",
        },
      },
      update: {},
      create: {
        clinicId: clinic.id,
        weekday: schedule.weekday,
        startTime: "10:00",
        endTime: "20:00",
        isActive: true,
      },
    });
    console.log(`Schedule created: ${schedule.day} 10:00 - 20:00`);
  }

  // 4. Create Clinic Admin
  console.log("Creating clinic admin...");
  const clinicAdmin = await prisma.user.upsert({
    where: { email: "admin.clinica@aagc.com" },
    update: {},
    create: {
      email: "admin.clinic@aagc.com",
      password: hashedPassword,
      firstName: "Administrador",
      lastName: "Clínica",
      role: Role.CLINIC_ADMIN,
      clinicId: clinic.id,
      phone: "5551234567",
      address: "Ciudad de México, México",
      dateOfBirth: new Date("1980-05-15"),
    },
  });

  console.log("Clinic admin created:", clinicAdmin.email);

  // 5. Create Reception Users
  console.log("Creating reception users...");
  const receptionUsers = [];

  const receptionData = [
    {
      email: "recepcion1@aagc.com",
      firstName: "Recepción",
      lastName: "Uno",
      phone: "5551234568",
    },
    {
      email: "recepcion2@aagc.com",
      firstName: "Recepción",
      lastName: "Dos",
      phone: "5551234569",
    },
    {
      email: "recepcion3@aagc.com",
      firstName: "Recepción",
      lastName: "Tres",
      phone: "5551234570",
    },
  ];

  for (const data of receptionData) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: Role.RECEPTION,
        clinicId: clinic.id,
        phone: data.phone,
        address: "Ciudad de México, México",
        dateOfBirth: new Date("1990-03-20"),
      },
    });
    receptionUsers.push(user);
    console.log("Reception user created:", user.email);
  }

  // 6. Create Nurse
  console.log("Creating nurse...");
  const nurse = await prisma.user.upsert({
    where: { email: "enfermero@demo.com" },
    update: {},
    create: {
      email: "enfermero@aagc.com",
      password: hashedPassword,
      firstName: "Enfermería",
      lastName: "Uno",
      role: Role.NURSE,
      clinicId: clinic.id,
      phone: "5551234570",
      address: "Ciudad de México, México",
      dateOfBirth: new Date("1988-07-10"),
    },
  });

  console.log("Nurse created:", nurse.email);

  // 7. Create Rooms for Doctors
  console.log("Creating rooms...");
  const rooms = [];

  for (let i = 1; i <= 10; i++) {
    const room = await prisma.room.upsert({
      where: {
        clinicId_name: {
          clinicId: clinic.id,
          name: `Consultorio ${i}`,
        },
      },
      update: {},
      create: {
        name: `Consultorio ${i}`,
        clinicId: clinic.id,
        location: `Piso ${Math.ceil(i / 5)}, Consultorio ${i}`,
        capacity: 1,
        isActive: true,
      },
    });
    rooms.push(room);
  }

  console.log(`${rooms.length} rooms created`);

  // 8. Create Specialties
  console.log("Creating specialties...");
  const specialtiesData = [
    {
      name: "Cirugía Cardiovascular y Torácica",
      description: "Especialidad quirúrgica enfocada en el corazón y tórax",
    },
    {
      name: "Asistencia Circulatoria y Trasplantes Torácicos",
      description: "Especialidad en asistencia mecánica y trasplantes",
    },
    {
      name: "Cardiología",
      description: "Especialidad médica del corazón",
    },
    {
      name: "Ecocardiografía",
      description: "Especialidad en imágenes cardíacas por ultrasonido",
    },
    {
      name: "Cirugía Vascular, Endovascular y Angiología",
      description: "Especialidad en cirugía de vasos sanguíneos",
    },
    {
      name: "Cardiología Intervencionista Estructural",
      description: "Intervencionismo en estructuras cardíacas",
    },
    {
      name: "Cardiología del Deporte",
      description: "Cardiología aplicada al deporte y atletas",
    },
    {
      name: "Medicina Interna",
      description: "Medicina general de adultos",
    },
    {
      name: "Cardiología Clínica",
      description: "Cardiología enfocada en consulta y diagnóstico",
    },
    {
      name: "Cardiología Intervencionista",
      description: "Procedimientos invasivos cardíacos",
    },
    {
      name: "Cardiología Nuclear",
      description: "Diagnóstico cardíaco con medicina nuclear",
    },
    {
      name: "Imagen Cardiovascular no Invasiva",
      description: "Técnicas de imagen no invasivas del corazón",
    },
    {
      name: "Cirugía Cardiotorácica",
      description: "Cirugía del corazón y tórax",
    },
    {
      name: "Cirugía Cardíaca de Mínima Invasión",
      description: "Técnicas quirúrgicas mínimamente invasivas",
    },
    {
      name: "Intervencionismo Cardíaco",
      description: "Procedimientos cardíacos percutáneos",
    },
    {
      name: "Nutrición Clínica y Deportiva",
      description: "Nutrición aplicada a la salud y el deporte",
    },
  ];

  const specialties = new Map();
  for (const data of specialtiesData) {
    const specialty = await prisma.specialty.upsert({
      where: { name: data.name },
      update: {},
      create: {
        name: data.name,
        description: data.description,
        isActive: true,
      },
    });
    specialties.set(data.name, specialty);
    console.log(`Specialty created: ${specialty.name}`);
  }

  // 9. Create Doctors
  console.log("Creating doctors...");
  const doctorsData = [
    {
      email: "doctor1@aagc.com",
      firstName: "Moisés C.",
      lastName: "Calderón",
      secondLastName: "Abbo",
      specialties: [
        "Cirugía Cardiovascular y Torácica",
        "Asistencia Circulatoria y Trasplantes Torácicos",
      ],
      primarySpecialty: "Cirugía Cardiovascular y Torácica",
      licenseNumber: "LIC001",
      phone: "+52 1 55 9198 2258",
      acronym: "MCA",
    },
    {
      email: "doctor2@aagc.com",
      firstName: "Andrés",
      lastName: "Pérez",
      secondLastName: "Bañuelos",
      specialties: ["Cardiología", "Ecocardiografía"],
      primarySpecialty: "Cardiología",
      licenseNumber: "LIC002",
      phone: "44 2186 5918",
      acronym: "APB",
    },
    {
      email: "doctor3@aagc.com",
      firstName: "Karen",
      lastName: "Moedano",
      secondLastName: "",
      specialties: ["Cirugía Vascular, Endovascular y Angiología"],
      primarySpecialty: "Cirugía Vascular, Endovascular y Angiología",
      licenseNumber: "LIC003",
      phone: "55 1224 8550",
      acronym: "KMO",
    },
    {
      email: "doctor4@aagc.com",
      firstName: "Fernando",
      lastName: "Gómez",
      secondLastName: "Peña",
      specialties: [
        "Cardiología Intervencionista Estructural",
        "Cardiología del Deporte",
      ],
      primarySpecialty: "Cardiología Intervencionista Estructural",
      licenseNumber: "LIC004",
      phone: "56 1170 0220",
      acronym: "FGP",
    },
    {
      email: "doctor5@aagc.com",
      firstName: "Alejandro G.",
      lastName: "Quintero",
      secondLastName: "Novella",
      specialties: ["Medicina Interna", "Cardiología Clínica"],
      primarySpecialty: "Medicina Interna",
      licenseNumber: "LIC005",
      phone: "55 5073 8571",
      acronym: "AQN",
    },
    {
      email: "doctor6@aagc.com",
      firstName: "Manuel",
      lastName: "Carrillo",
      secondLastName: "Cornejo",
      specialties: ["Cardiología Intervencionista", "Cardiología del Deporte"],
      primarySpecialty: "Cardiología Intervencionista",
      licenseNumber: "LIC006",
      phone: "55 9189 0300",
      acronym: "MCC",
    },
    {
      email: "doctor7@aagc.com",
      firstName: "Nadia",
      lastName: "Canseco",
      secondLastName: "León",
      specialties: [
        "Cardiología",
        "Cardiología Nuclear",
        "Imagen Cardiovascular no Invasiva",
      ],
      primarySpecialty: "Cardiología",
      licenseNumber: "LIC007",
      phone: "55 4377 7802",
      acronym: "NCL",
    },
    {
      email: "doctor8@aagc.com",
      firstName: "Alain Ledu",
      lastName: "Lara",
      secondLastName: "Calvillo",
      specialties: [
        "Cirugía Cardiotorácica",
        "Cirugía Cardíaca de Mínima Invasión",
        "Intervencionismo Cardíaco",
      ],
      primarySpecialty: "Cirugía Cardiotorácica",
      licenseNumber: "LIC008",
      phone: "55 3670 6983",
      acronym: "ALC",
    },
    {
      email: "doctor9@aagc.com",
      firstName: "Mauricio",
      lastName: "Damián",
      secondLastName: "Gómez",
      specialties: ["Cirugía Cardiovascular y Cardiotorácica"],
      primarySpecialty: "Cirugía Cardiovascular y Cardiotorácica",
      licenseNumber: "LIC009",
      phone: "55 1950 6666",
      acronym: "MDG",
    },
    {
      email: "doctor10@aagc.com",
      firstName: "Victoria",
      lastName: "Fernández",
      secondLastName: "Pellón",
      specialties: ["Nutrición Clínica y Deportiva"],
      primarySpecialty: "Nutrición Clínica y Deportiva",
      licenseNumber: "LIC010",
      phone: "55 6422 2086",
      acronym: "VFP",
    },
  ];

  for (let i = 0; i < doctorsData.length; i++) {
    const data = doctorsData[i];

    // Create User with DOCTOR role
    const doctorUser = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        secondLastName: data.secondLastName,
        role: Role.DOCTOR,
        clinicId: clinic.id,
        phone: data.phone,
        licenseNumber: data.licenseNumber,
        address: "Ciudad de México, México",
        dateOfBirth: new Date("1975-01-01"),
      },
    });

    // Create Doctor record
    const doctor = await prisma.doctor.upsert({
      where: { userId: doctorUser.id },
      update: {},
      create: {
        userId: doctorUser.id,
        clinicId: clinic.id,
        roomId: rooms[i].id,
        acronym: data.acronym,
        isActive: true,
      },
    });

    // Assign specialties to doctor
    for (const specialtyName of data.specialties) {
      const specialty = specialties.get(specialtyName);
      if (specialty) {
        const isPrimary = specialtyName === data.primarySpecialty;
        await prisma.doctorSpecialty.upsert({
          where: {
            doctorId_specialtyId: {
              doctorId: doctor.id,
              specialtyId: specialty.id,
            },
          },
          update: {},
          create: {
            doctorId: doctor.id,
            specialtyId: specialty.id,
            isPrimary: isPrimary,
          },
        });
      }
    }

    console.log(
      `Doctor created: ${doctorUser.email} (${data.specialties.join(", ")})`
    );
  }

  console.log("\n✅ Seed completed successfully!");
  console.log("\n📋 Summary:");
  console.log("- 1 Admin global");
  console.log("- 1 Clínica");
  console.log("- 1 Admin de clínica");
  console.log("- 3 Recepcionistas");
  console.log("- 1 Enfermero");
  console.log("- 10 Doctores");
  console.log("- 10 Consultorios");
  console.log(`- ${specialtiesData.length} Especialidades`);
  console.log(
    "\n🔑 Todos los usuarios tienen la misma contraseña configurada en ADMIN_PASSWORD"
  );
  console.log("📧 Emails de los usuarios creados:");
  console.log("  - Admin: " + adminUsername);
  console.log("  - Admin Clínica: admin.clinic@aagc.com");
  console.log(
    "  - Recepción: recepcion1@aagc.com, recepcion2@aagc.com, recepcion3@aagc.com"
  );
  console.log("  - Enfermero: enfermero@aagc.com");
  console.log("  - Doctores: doctor1@aagc.com a doctor10@aagc.com");
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
