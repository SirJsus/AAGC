"use server";

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ImportJobType, ImportJobStatus, Prisma, Role } from "@prisma/client";
import { createAuditLog } from "./audit";
import { parse } from "csv-parse/sync";
import bcrypt from "bcryptjs";

export interface CreateImportJobInput {
  clinicId?: string;
  type: ImportJobType;
  fileName: string;
  fileContent: string;
}

export async function getImportJobs(clinicId?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("No autorizado");
  }

  const where: Prisma.ImportJobWhereInput = {
    deletedAt: null,
  };

  if (clinicId) {
    where.clinicId = clinicId;
  }

  const jobs = await prisma.importJob.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  return jobs;
}

export async function getImportJobById(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("No autorizado");
  }

  const job = await prisma.importJob.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  return job;
}

export async function createImportJob(data: CreateImportJobInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("No autorizado");
  }

  // Crear el job inicial
  const job = await prisma.importJob.create({
    data: {
      clinicId: data.clinicId || null,
      type: data.type,
      status: "PENDING",
      fileName: data.fileName,
      createdBy: session.user.id,
    },
  });

  // Procesar el archivo en background
  processImportJob(job.id, data.fileContent, session.user.id).catch(
    console.error
  );

  return job;
}

async function processImportJob(
  jobId: string,
  fileContent: string,
  userId: string
) {
  try {
    // Actualizar status a PROCESSING
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
      },
    });

    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error("Job not found");
    }

    // Parsear el archivo (CSV o JSON)
    let records: any[] = [];

    if (job.fileName.endsWith(".json")) {
      records = JSON.parse(fileContent);
    } else if (job.fileName.endsWith(".csv")) {
      records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } else {
      throw new Error("Formato de archivo no soportado");
    }

    const totalRows = records.length;
    let successRows = 0;
    let errorRows = 0;
    const errors: any[] = [];

    // Procesar según el tipo
    for (const [index, record] of records.entries()) {
      try {
        if (job.type === "PATIENTS") {
          await importPatient(record, job.clinicId, userId);
        } else if (job.type === "DOCTORS") {
          await importDoctor(record, job.clinicId, userId);
        } else if (job.type === "APPOINTMENTS") {
          await importAppointment(record, job.clinicId, userId);
        }

        successRows++;
      } catch (error: any) {
        errorRows++;
        errors.push({
          row: index + 1,
          data: record,
          error: error.message,
        });
      }

      // Actualizar progreso cada 10 registros
      if ((index + 1) % 10 === 0) {
        await prisma.importJob.update({
          where: { id: jobId },
          data: {
            processedRows: index + 1,
          },
        });
      }
    }

    // Actualizar job como completado
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: errorRows === totalRows ? "FAILED" : "COMPLETED",
        totalRows,
        processedRows: totalRows,
        successRows,
        errorRows,
        errors: errors as unknown as Prisma.JsonArray,
        completedAt: new Date(),
      },
    });
  } catch (error: any) {
    // Actualizar job como fallido
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errors: [{ error: error.message }] as unknown as Prisma.JsonArray,
        completedAt: new Date(),
      },
    });
  }
}

async function importPatient(
  data: any,
  clinicId: string | null,
  userId: string
) {
  if (!clinicId) {
    throw new Error("Clinic ID is required for patient import");
  }

  // Validar campos requeridos
  if (!data.firstName || !data.lastName || !data.phone) {
    throw new Error("Missing required fields: firstName, lastName, phone");
  }

  // Buscar doctor si se proporciona (buscamos por el licenseNumber del usuario asociado)
  let doctorId: string | null = null;
  const doctorLicense =
    data.doctorLicense || data.licenseNumber || data.license;
  if (doctorLicense) {
    const doctor = await prisma.doctor.findFirst({
      where: {
        clinicId,
        deletedAt: null,
        user: {
          licenseNumber: doctorLicense,
        },
      },
      include: { user: true },
    });
    doctorId = doctor?.id || null;
  }

  // Generar customId si no se proporciona
  let customId = data.customId;
  if (!customId) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
    });

    const doctor = doctorId
      ? await prisma.doctor.findUnique({
          where: { id: doctorId },
        })
      : null;

    const count = await prisma.patient.count({
      where: { clinicId },
    });

    // Nota: el campo correcto en schema.prisma es `clinicAcronym`
    const clinicAcronym = clinic?.clinicAcronym || "P";
    const doctorAcronym = doctor?.acronym || "G";
    customId = `${clinicAcronym}${doctorAcronym}${(count + 1).toString().padStart(4, "0")}`;
  }

  // Verificar que el customId no exista
  const existing = await prisma.patient.findUnique({
    where: { customId },
  });

  if (existing) {
    throw new Error(`Patient with customId ${customId} already exists`);
  }

  // Crear el paciente
  const patient = await prisma.patient.create({
    data: {
      customId,
      firstName: data.firstName,
      lastName: data.lastName,
      secondLastName: data.secondLastName || null,
      phone: data.phone,
      email: data.email || null,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      gender: data.gender || null,
      address: data.address || null,
      emergencyContactPhone: data.emergencyContact || null,
      notes: data.notes || null,
      clinicId,
      doctorId,
    },
  });

  // Audit log
  await createAuditLog({
    userId,
    clinicId,
    action: "IMPORT",
    entityType: "Patient",
    entityId: patient.id,
    newValues: patient as unknown as Prisma.JsonObject,
  });

  return patient;
}

async function importDoctor(
  data: any,
  clinicId: string | null,
  userId: string
) {
  if (!clinicId) {
    throw new Error("Clinic ID is required for doctor import");
  }

  // Validar campos requeridos
  if (!data.firstName || !data.lastName) {
    throw new Error("Missing required fields: firstName, lastName");
  }

  // Normalizar licenseNumber desde posibles columnas (license, licenseNumber, doctorLicense)
  const licenseNumber =
    data.license || data.licenseNumber || data.doctorLicense;
  if (!licenseNumber) {
    throw new Error("Missing required field: licenseNumber");
  }

  // Verificar que no exista un usuario con esa licenseNumber
  const existingUser = await prisma.user.findUnique({
    where: { licenseNumber },
  });

  if (existingUser) {
    throw new Error(`Doctor with license ${licenseNumber} already exists`);
  }

  // Preparar email (si no se proporciona, generamos uno temporal único)
  const email = data.email || `doctor.${licenseNumber}@import.local`;

  // Generar contraseña aleatoria y hashearla (usuario podrá resetear luego)
  const randomPwd = Math.random().toString(36).slice(2, 10);
  const hashedPassword = await bcrypt.hash(randomPwd, 12);

  // Crear el usuario asociado con rol DOCTOR
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      secondLastName: data.secondLastName || null,
      noSecondLastName: data.noSecondLastName || false,
      phone: data.phone || null,
      role: Role.DOCTOR,
      clinicId,
      specialty: data.specialty || null,
      licenseNumber: licenseNumber,
      isActive: true,
    },
  });

  // Generar acronym si no se proporciona (mismo comportamiento que en users.create)
  let acronym = data.acronym;
  if (!acronym) {
    const firstInitial = data.firstName.charAt(0).toUpperCase();
    const lastInitial = data.lastName.charAt(0).toUpperCase();
    const secondLastInitial = data.secondLastName
      ? data.secondLastName.charAt(0).toUpperCase()
      : "";
    acronym = `Dr${firstInitial}${lastInitial}${secondLastInitial}`;
  }

  // Crear el registro en Doctor apuntando al User creado
  const doctor = await prisma.doctor.create({
    data: {
      userId: user.id,
      clinicId,
      acronym,
      roomId: data.roomId || null,
      isActive: true,
    },
  });

  // Audit logs: registrar creación de user y doctor
  await createAuditLog({
    userId,
    clinicId,
    action: "IMPORT",
    entityType: "User",
    entityId: user.id,
    newValues: user as unknown as Prisma.JsonObject,
  });

  await createAuditLog({
    userId,
    clinicId,
    action: "IMPORT",
    entityType: "Doctor",
    entityId: doctor.id,
    newValues: doctor as unknown as Prisma.JsonObject,
  });

  return doctor;
}

async function importAppointment(
  data: any,
  clinicId: string | null,
  userId: string
) {
  if (!clinicId) {
    throw new Error("Clinic ID is required for appointment import");
  }

  // Validar campos requeridos
  if (
    !data.patientCustomId ||
    !data.doctorLicense ||
    !data.date ||
    !data.startTime ||
    !data.endTime
  ) {
    throw new Error(
      "Missing required fields: patientCustomId, doctorLicense, date, startTime, endTime"
    );
  }

  // Buscar paciente
  const patient = await prisma.patient.findFirst({
    where: {
      customId: data.patientCustomId,
      clinicId,
      deletedAt: null,
    },
  });

  if (!patient) {
    throw new Error(`Patient with customId ${data.patientCustomId} not found`);
  }

  // Buscar doctor por el licenseNumber del usuario asociado
  const doctor = await prisma.doctor.findFirst({
    where: {
      clinicId,
      deletedAt: null,
      user: {
        licenseNumber: data.doctorLicense,
      },
    },
    include: { user: true },
  });

  if (!doctor) {
    throw new Error(`Doctor with license ${data.doctorLicense} not found`);
  }

  // Verificar conflictos
  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId: doctor.id,
      date: data.date,
      startTime: data.startTime,
      deletedAt: null,
      status: {
        notIn: ["CANCELLED", "NO_SHOW"],
      },
    },
  });

  if (conflict) {
    throw new Error(`Appointment conflict at ${data.date} ${data.startTime}`);
  }

  // Crear la cita
  const appointment = await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      clinicId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      status: data.status || "PENDING",
      notes: data.notes || null,
      customReason: data.customReason || null,
    },
  });

  // Audit log
  await createAuditLog({
    userId,
    clinicId,
    action: "IMPORT",
    entityType: "Appointment",
    entityId: appointment.id,
    newValues: appointment as unknown as Prisma.JsonObject,
  });

  return appointment;
}

export async function deleteImportJob(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("No autorizado");
  }

  const job = await prisma.importJob.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
  });

  return job;
}
