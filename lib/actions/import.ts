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

  // Determinar la clínica a usar
  let clinicId: string | null = data.clinicId || null;

  // Si no se proporciona clinicId, usar la del usuario (si no es admin)
  if (!clinicId) {
    if (session.user.role === Role.ADMIN) {
      throw new Error("Los administradores deben especificar una clínica");
    }
    clinicId = session.user.clinicId;
  }

  // Si es admin, validar que tenga acceso a la clínica (opcional, por seguridad)
  if (session.user.role !== Role.ADMIN && clinicId !== session.user.clinicId) {
    throw new Error("No tienes permiso para importar datos a esta clínica");
  }

  // Crear el job inicial
  const job = await prisma.importJob.create({
    data: {
      clinicId: clinicId,
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
        encoding: "utf8",
        bom: true, // Manejar BOM (Byte Order Mark) si está presente
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

  // Validar campos requeridos BÁSICOS
  if (!data.firstName || !data.lastName) {
    throw new Error("Missing required fields: firstName, lastName");
  }

  // Validar campos del customId (solo 3 requeridos)
  if (
    !data.customIdClinic ||
    !data.customIdDoctor ||
    data.customIdNumber === undefined
  ) {
    throw new Error(
      "Missing required ID fields: customIdClinic, customIdDoctor, customIdNumber"
    );
  }

  // Construir customId desde las 3 partes + letra del apellido
  const clinicPart = data.customIdClinic.toString().trim();
  const doctorPart = data.customIdDoctor.toString().trim();

  // Extraer automáticamente la primera letra del apellido
  const lastNamePart = data.lastName.charAt(0).toUpperCase();

  const numberPart = data.customIdNumber;

  // Formatear el número con padding a 3 dígitos
  const formattedNumber =
    typeof numberPart === "number"
      ? numberPart.toString().padStart(3, "0")
      : numberPart.toString().padStart(3, "0");

  const customId = `${clinicPart}-${doctorPart}-${lastNamePart}${formattedNumber}`;

  // Verificar que el customId no exista
  const existing = await prisma.patient.findUnique({
    where: { customId },
  });

  if (existing) {
    throw new Error(`Patient with customId ${customId} already exists`);
  }

  // Generar teléfono temporal si no se proporciona
  const phone = data.phone || `temp-${Date.now()}`;

  // Crear el paciente (modo simplificado)
  const patient = await prisma.patient.create({
    data: {
      customId,
      firstName: data.firstName,
      lastName: data.lastName,
      secondLastName: data.secondLastName || null,
      noSecondLastName:
        data.noSecondLastName === true || data.noSecondLastName === "true",
      phone,
      email: data.email || null,
      clinicId,
      pendingCompletion: true, // Siempre marcar como pendiente de completar
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
      noSecondLastName:
        data.noSecondLastName === true || data.noSecondLastName === "true",
      phone: data.phone || null,
      address: data.address || null,
      dateOfBirth:
        data.dateOfBirth || data.birthDate
          ? new Date(data.dateOfBirth || data.birthDate)
          : null,
      role: Role.DOCTOR,
      clinicId,
      licenseNumber: licenseNumber,
      isActive: data.isActive !== false && data.isActive !== "false",
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
    acronym = `${firstInitial}${lastInitial}${secondLastInitial}`;
  }

  // Buscar roomId si se proporciona nombre de consultorio
  let roomId: string | null = data.roomId || null;
  if (!roomId && data.roomName) {
    const room = await prisma.room.findFirst({
      where: {
        clinicId,
        name: data.roomName,
        deletedAt: null,
      },
    });
    roomId = room?.id || null;
  }

  // Crear el registro en Doctor apuntando al User creado
  const doctor = await prisma.doctor.create({
    data: {
      userId: user.id,
      clinicId,
      acronym,
      roomId,
      isActive: data.isActive !== false && data.isActive !== "false",
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

  // Buscar appointmentType si se proporciona
  let appointmentTypeId: string | null = data.appointmentTypeId || null;
  if (!appointmentTypeId && data.appointmentTypeName) {
    const appointmentType = await prisma.appointmentType.findFirst({
      where: {
        clinicId,
        name: data.appointmentTypeName,
        deletedAt: null,
      },
    });
    appointmentTypeId = appointmentType?.id || null;
  }

  // Buscar room si se proporciona
  let roomId: string | null = data.roomId || null;
  if (!roomId && data.roomName) {
    const room = await prisma.room.findFirst({
      where: {
        clinicId,
        name: data.roomName,
        deletedAt: null,
      },
    });
    roomId = room?.id || null;
  }

  // Verificar conflictos con doctor
  const doctorConflict = await prisma.appointment.findFirst({
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

  if (doctorConflict) {
    throw new Error(
      `Doctor has appointment conflict at ${data.date} ${data.startTime}`
    );
  }

  // Verificar conflictos con sala si se asignó
  if (roomId) {
    const roomConflict = await prisma.appointment.findFirst({
      where: {
        roomId,
        date: data.date,
        startTime: data.startTime,
        deletedAt: null,
        status: {
          notIn: ["CANCELLED", "NO_SHOW"],
        },
      },
    });

    if (roomConflict) {
      throw new Error(
        `Room has appointment conflict at ${data.date} ${data.startTime}`
      );
    }
  }

  // Preparar datos de pago
  const paymentMethod = data.paymentMethod || null;
  const paymentConfirmed =
    data.paymentConfirmed === true || data.paymentConfirmed === "true";

  // Preparar precio personalizado si existe
  const customPrice = data.customPrice ? parseFloat(data.customPrice) : null;

  // Crear la cita
  const appointment = await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      clinicId,
      roomId,
      appointmentTypeId,
      customReason: data.customReason || null,
      customPrice,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      status: data.status || "PENDING",
      paymentMethod,
      paymentConfirmed,
      notes: data.notes || null,
      cancelReason: data.cancelReason || null,
      cancelledAt: data.cancelledAt ? new Date(data.cancelledAt) : null,
      cancelledBy: data.cancelledBy || null,
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

  // Convert Decimal to number for consistency
  return {
    ...appointment,
    customPrice: appointment.customPrice?.toNumber() ?? null,
  };
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
