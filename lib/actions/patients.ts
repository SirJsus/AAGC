"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Permissions } from "@/lib/permissions";
import { Gender } from "@prisma/client";

// Helper function to remove accents from strings
function removeAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

const createPatientSchema = z.object({
  firstName: z.string().min(1, "Por favor ingresa el nombre del paciente"),
  lastName: z
    .string()
    .min(1, "Por favor ingresa el apellido paterno del paciente"),
  secondLastName: z.string().optional(),
  noSecondLastName: z.boolean().optional(),
  phone: z
    .string()
    .min(1, "Por favor ingresa el número de teléfono del paciente"),
  email: z
    .string()
    .email("Por favor ingresa un correo electrónico válido")
    .optional()
    .or(z.literal("")),
  birthDate: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  address: z.string().optional(),
  emergencyContactFirstName: z.string().optional(),
  emergencyContactLastName: z.string().optional(),
  emergencyContactSecondLastName: z.string().optional(),
  emergencyContactNoSecondLastName: z.boolean().optional(),
  emergencyContactPhone: z.string().optional(),
  primaryDoctorFirstName: z.string().optional(),
  primaryDoctorLastName: z.string().optional(),
  primaryDoctorSecondLastName: z.string().optional(),
  primaryDoctorNoSecondLastName: z.boolean().optional(),
  primaryDoctorPhone: z.string().optional(),
  notes: z.string().optional(),
  doctorId: z.string().optional(),
  customDoctorAcronym: z.string().length(3).optional(), // Custom 3-letter acronym for doctor
  // Billing fields
  billingIsSameAsPatient: z.boolean().optional(),
  billingName: z.string().optional(),
  billingRFC: z.string().optional(),
  billingTaxRegime: z.string().optional(),
  billingPostalCode: z.string().optional(),
  billingEmail: z
    .string()
    .email("Por favor ingresa un correo electrónico válido para facturación")
    .optional()
    .or(z.literal("")),
});

export async function createPatient(data: z.infer<typeof createPatientSchema>) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManagePatients(session.user)) {
    throw new Error("Unauthorized");
  }

  const validatedData = createPatientSchema.parse(data);

  // Get clinic for patient - prioritize doctor's clinic if doctorId is provided
  let clinic = null;

  if (validatedData.doctorId) {
    // If a doctor is selected, use the doctor's clinic
    const doctor = await prisma.doctor.findUnique({
      where: { id: validatedData.doctorId },
      include: { clinic: true },
    });

    if (doctor && doctor.clinic.isActive) {
      clinic = doctor.clinic;
    }
  }

  // Fallback to user's clinic or first active clinic
  if (!clinic) {
    if (session.user.clinicId) {
      clinic = await prisma.clinic.findFirst({
        where: {
          id: session.user.clinicId,
          isActive: true,
        },
      });
    } else if (session.user.role === "ADMIN") {
      // For ADMIN users without a clinic, get the first active clinic
      clinic = await prisma.clinic.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      });
    }
  }

  if (!clinic) {
    throw new Error(
      "No se encontró ninguna clínica activa. Por favor contacta al administrador"
    );
  }

  // Generate patient acronym: {FirstInitial}{LastNameInitial}{SecondLastNameInitial}
  const patientAcronym = removeAccents(
    validatedData.firstName.charAt(0) +
      validatedData.lastName.charAt(0) +
      (validatedData.secondLastName
        ? validatedData.secondLastName.charAt(0)
        : validatedData.lastName.charAt(1) || "X")
  );

  // Get doctor acronym (from doctor record or custom)
  let doctorAcronym = "GEN"; // Default
  if (validatedData.customDoctorAcronym) {
    doctorAcronym = validatedData.customDoctorAcronym.toUpperCase();
  } else if (validatedData.doctorId) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: validatedData.doctorId },
      select: { acronym: true },
    });
    if (doctor) {
      doctorAcronym = doctor.acronym.toUpperCase();
    }
  }

  // Get first letter of last name for sequencing (without accents)
  const lastNameInitial = removeAccents(validatedData.lastName.charAt(0));

  // Count existing patients with same last name initial in this clinic
  const patientsWithSameLetter = await prisma.patient.findMany({
    where: {
      clinicId: clinic.id,
      lastName: {
        startsWith: lastNameInitial,
        mode: "insensitive",
      },
    },
    select: { customId: true, lastName: true },
    orderBy: { createdAt: "asc" },
  });

  // Calculate next number for this letter
  const nextNumber = patientsWithSameLetter.length + 1;

  // Generate custom ID: {PatientAcronym}-{DoctorAcronym}-{Letter}{Number}
  const customId = `${patientAcronym}-${doctorAcronym}-${lastNameInitial}${nextNumber
    .toString()
    .padStart(3, "0")}`;

  // Double-check for uniqueness (in case of race condition)
  const existingWithSameId = await prisma.patient.findFirst({
    where: {
      clinicId: clinic.id,
      customId: customId,
    },
  });

  if (existingWithSameId) {
    // If somehow the ID exists, add timestamp to make it unique
    const timestamp = Date.now().toString().slice(-4);
    throw new Error(
      `Ya existe un paciente con este identificador. Por favor intenta nuevamente. Si el problema persiste, contacta al administrador. (Ref: ${customId}-${timestamp})`
    );
  }

  const patient = await prisma.patient.create({
    data: {
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      secondLastName: validatedData.secondLastName || null,
      noSecondLastName: validatedData.noSecondLastName || false,
      phone: validatedData.phone,
      clinicId: clinic.id,
      customId,
      customDoctorAcronym: validatedData.customDoctorAcronym || null,
      email: validatedData.email || null,
      birthDate: validatedData.birthDate
        ? new Date(validatedData.birthDate)
        : null,
      gender: validatedData.gender || Gender.OTHER,
      address: validatedData.address || null,
      emergencyContactFirstName:
        validatedData.emergencyContactFirstName || null,
      emergencyContactLastName: validatedData.emergencyContactLastName || null,
      emergencyContactSecondLastName:
        validatedData.emergencyContactSecondLastName || null,
      emergencyContactNoSecondLastName:
        validatedData.emergencyContactNoSecondLastName || false,
      emergencyContactPhone: validatedData.emergencyContactPhone || null,
      primaryDoctorFirstName: validatedData.primaryDoctorFirstName || null,
      primaryDoctorLastName: validatedData.primaryDoctorLastName || null,
      primaryDoctorSecondLastName:
        validatedData.primaryDoctorSecondLastName || null,
      primaryDoctorNoSecondLastName:
        validatedData.primaryDoctorNoSecondLastName || false,
      primaryDoctorPhone: validatedData.primaryDoctorPhone || null,
      notes: validatedData.notes || null,
      doctorId: validatedData.doctorId || null,
      pendingCompletion: true, // Mark as temporary/pending completion
      // Billing fields
      billingIsSameAsPatient: validatedData.billingIsSameAsPatient ?? true,
      billingName: validatedData.billingName || null,
      billingRFC: validatedData.billingRFC || null,
      billingTaxRegime: validatedData.billingTaxRegime || null,
      billingPostalCode: validatedData.billingPostalCode || null,
      billingEmail: validatedData.billingEmail || null,
    },
    include: {
      clinic: true,
      doctor: {
        include: { user: true },
      },
    },
  });

  revalidatePath("/patients");
  return patient;
}

// Preview patient ID before creation
export async function previewPatientId(data: {
  firstName: string;
  lastName: string;
  secondLastName?: string;
  doctorId?: string;
  customDoctorAcronym?: string;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("No tienes permisos para realizar esta acción");
  }

  // Get clinic - prioritize doctor's clinic if doctorId is provided
  let clinic = null;

  if (data.doctorId) {
    // If a doctor is selected, use the doctor's clinic
    const doctor = await prisma.doctor.findUnique({
      where: { id: data.doctorId },
      include: { clinic: true },
    });

    if (doctor && doctor.clinic.isActive) {
      clinic = doctor.clinic;
    }
  }

  // Fallback to user's clinic or first active clinic
  if (!clinic) {
    if (session.user.clinicId) {
      clinic = await prisma.clinic.findFirst({
        where: {
          id: session.user.clinicId,
          isActive: true,
        },
      });
    } else if (session.user.role === "ADMIN") {
      clinic = await prisma.clinic.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      });
    }
  }

  if (!clinic) {
    return null;
  }

  // Generate patient acronym (without accents)
  const patientAcronym = removeAccents(
    data.firstName.charAt(0) +
      data.lastName.charAt(0) +
      (data.secondLastName
        ? data.secondLastName.charAt(0)
        : data.lastName.charAt(1) || "X")
  );

  // Get doctor acronym
  let doctorAcronym = "GEN";
  if (data.customDoctorAcronym) {
    doctorAcronym = data.customDoctorAcronym.toUpperCase();
  } else if (data.doctorId) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: data.doctorId },
      select: { acronym: true },
    });
    if (doctor) {
      doctorAcronym = doctor.acronym.toUpperCase();
    }
  }

  // Get last name initial (without accents)
  const lastNameInitial = removeAccents(data.lastName.charAt(0));

  // Count existing patients
  const patientsWithSameLetter = await prisma.patient.findMany({
    where: {
      clinicId: clinic.id,
      lastName: {
        startsWith: lastNameInitial,
        mode: "insensitive",
      },
    },
  });

  const nextNumber = patientsWithSameLetter.length + 1;

  return `${patientAcronym}-${doctorAcronym}-${lastNameInitial}${nextNumber
    .toString()
    .padStart(3, "0")}`;
}

export async function updatePatient(
  id: string,
  data: z.infer<typeof createPatientSchema>
) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManagePatients(session.user)) {
    throw new Error("No tienes permisos para actualizar pacientes");
  }

  const validatedData = createPatientSchema.parse(data);

  // Get clinic from doctor if doctorId is provided
  let clinicId: string | undefined;
  if (validatedData.doctorId) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: validatedData.doctorId },
      select: { clinicId: true },
    });
    if (doctor) {
      clinicId = doctor.clinicId;
    }
  }

  // Check if patient has all required data
  const hasCompleteData = !!(
    validatedData.firstName &&
    validatedData.lastName &&
    (validatedData.secondLastName || validatedData.noSecondLastName) &&
    validatedData.phone &&
    validatedData.birthDate &&
    validatedData.gender
  );

  const patient = await prisma.patient.update({
    where: { id },
    data: {
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      secondLastName: validatedData.secondLastName || null,
      noSecondLastName: validatedData.noSecondLastName || false,
      phone: validatedData.phone,
      customDoctorAcronym: validatedData.customDoctorAcronym || null,
      email: validatedData.email || null,
      birthDate: validatedData.birthDate
        ? new Date(validatedData.birthDate)
        : null,
      gender: validatedData.gender || Gender.OTHER,
      address: validatedData.address || null,
      emergencyContactFirstName:
        validatedData.emergencyContactFirstName || null,
      emergencyContactLastName: validatedData.emergencyContactLastName || null,
      emergencyContactSecondLastName:
        validatedData.emergencyContactSecondLastName || null,
      emergencyContactNoSecondLastName:
        validatedData.emergencyContactNoSecondLastName || false,
      emergencyContactPhone: validatedData.emergencyContactPhone || null,
      primaryDoctorFirstName: validatedData.primaryDoctorFirstName || null,
      primaryDoctorLastName: validatedData.primaryDoctorLastName || null,
      primaryDoctorSecondLastName:
        validatedData.primaryDoctorSecondLastName || null,
      primaryDoctorNoSecondLastName:
        validatedData.primaryDoctorNoSecondLastName || false,
      primaryDoctorPhone: validatedData.primaryDoctorPhone || null,
      notes: validatedData.notes || null,
      doctorId: validatedData.doctorId || null,
      ...(clinicId && { clinicId }), // Update clinic only if doctor is selected
      pendingCompletion: !hasCompleteData, // Mark as completed when all required data is present
      // Billing fields
      billingIsSameAsPatient: validatedData.billingIsSameAsPatient ?? true,
      billingName: validatedData.billingName || null,
      billingRFC: validatedData.billingRFC || null,
      billingTaxRegime: validatedData.billingTaxRegime || null,
      billingPostalCode: validatedData.billingPostalCode || null,
      billingEmail: validatedData.billingEmail || null,
    },
    include: {
      clinic: true,
      doctor: {
        include: { user: true },
      },
    },
  });

  revalidatePath("/patients");
  return patient;
}

export async function deletePatient(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManagePatients(session.user)) {
    throw new Error("No tienes permisos para eliminar pacientes");
  }

  await prisma.patient.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  revalidatePath("/patients");
}

export async function hardDeletePatient(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canHardDeletePatients(session.user)) {
    throw new Error(
      "No tienes permisos para eliminar permanentemente pacientes"
    );
  }

  // Verificar si el paciente existe
  const patient = await prisma.patient.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      _count: {
        select: {
          appointments: true,
          consents: true,
          insurances: true,
        },
      },
    },
  });

  if (!patient) {
    throw new Error("No se encontró el paciente solicitado");
  }

  // Verificar si tiene relaciones activas
  const hasActiveRelations =
    patient._count.appointments > 0 ||
    patient._count.consents > 0 ||
    patient._count.insurances > 0;

  if (hasActiveRelations) {
    throw new Error(
      `No se puede eliminar permanentemente al paciente ${patient.firstName} ${patient.lastName} porque tiene registros relacionados (citas: ${patient._count.appointments}, consentimientos: ${patient._count.consents}, seguros: ${patient._count.insurances}). Por favor, elimina estos registros primero o usa la eliminación lógica.`
    );
  }

  // Eliminar permanentemente
  await prisma.patient.delete({
    where: { id },
  });

  revalidatePath("/patients");
}

export async function reactivatePatient(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManagePatients(session.user)) {
    throw new Error("No tienes permisos para reactivar pacientes");
  }

  // Verificar si el paciente existe
  const patient = await prisma.patient.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });

  if (!patient) {
    throw new Error("No se encontró el paciente solicitado");
  }

  if (patient.isActive) {
    throw new Error("Este paciente ya está activo");
  }

  // Reactivar el paciente
  await prisma.patient.update({
    where: { id },
    data: {
      isActive: true,
      deletedAt: null,
    },
  });

  revalidatePath("/patients");
}

// New interface for pagination and filters
export interface GetPatientsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "active" | "inactive" | "all";
  gender?: Gender | "all";
  doctorId?: string | "all";
  clinicId?: string | "all";
  pendingCompletion?: boolean | "all";
}

export async function getPatients(params: GetPatientsParams = {}) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewPatients(session.user)) {
    throw new Error("No tienes permisos para ver pacientes");
  }

  const {
    page = 1,
    pageSize = 20,
    search = "",
    status = "all",
    gender = "all",
    doctorId = "all",
    clinicId = "all",
    pendingCompletion = "all",
  } = params;

  const skip = (page - 1) * pageSize;

  // Build where clause
  const baseWhere: any = {};

  // Role-based filtering
  if (session.user.role === "DOCTOR") {
    // Get the doctor record for this user
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.user.id },
    });

    if (!doctor) {
      return { patients: [], total: 0, totalPages: 0, currentPage: page };
    }

    // Get all unique patient IDs from appointments with this doctor
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
      },
      select: {
        patientId: true,
      },
      distinct: ["patientId"],
    });

    const patientIds = appointments.map((a) => a.patientId);

    if (patientIds.length === 0) {
      return { patients: [], total: 0, totalPages: 0, currentPage: page };
    }

    baseWhere.id = { in: patientIds };
  } else if (session.user.role !== "ADMIN") {
    baseWhere.clinicId = session.user.clinicId || "";
  }

  // Clinic filter (only for ADMIN)
  if (session.user.role === "ADMIN" && clinicId !== "all") {
    baseWhere.clinicId = clinicId;
  }

  // Status filter
  if (status === "active") {
    baseWhere.isActive = true;
  } else if (status === "inactive") {
    baseWhere.isActive = false;
  }

  // Gender filter
  if (gender !== "all") {
    baseWhere.gender = gender;
  }

  // Doctor filter
  if (doctorId !== "all") {
    baseWhere.doctorId = doctorId;
  }

  // Pending completion filter
  if (pendingCompletion !== "all") {
    baseWhere.pendingCompletion = pendingCompletion;
  }

  // Get all patients matching base filters (without search initially)
  let allPatients = await prisma.patient.findMany({
    where: baseWhere,
    include: {
      clinic: true,
      doctor: {
        include: { user: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  // Apply flexible search filter if search term is provided
  if (search) {
    // Normalize query: remove accents and convert to uppercase
    const normalizedQuery = removeAccents(search.trim());

    // Split query into words for flexible matching
    const queryWords = normalizedQuery
      .split(/\s+/)
      .filter((word) => word.length > 0);

    // Filter patients by checking if all query words appear in the full name or other fields
    allPatients = allPatients.filter((patient) => {
      const fullName = removeAccents(
        `${patient.firstName} ${patient.lastName} ${patient.secondLastName || ""}`
      );
      const phone = patient.phone || "";
      const email = removeAccents(patient.email || "");
      const customId = removeAccents(patient.customId || "");

      // Check if all query words appear somewhere in the searchable fields
      return queryWords.every((word) => {
        return (
          fullName.includes(word) ||
          phone.includes(word) ||
          email.includes(word) ||
          customId.includes(word)
        );
      });
    });
  }

  // Get total count after filtering
  const total = allPatients.length;

  // Apply pagination
  const patients = allPatients.slice(skip, skip + pageSize);

  const totalPages = Math.ceil(total / pageSize);

  return {
    patients,
    total,
    totalPages,
    currentPage: page,
  };
}

export async function getPatient(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewPatients(session.user)) {
    throw new Error("No tienes permisos para ver la información de pacientes");
  }

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      clinic: true,
      doctor: {
        include: { user: true },
      },
      consents: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      },
      insurances: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!patient) {
    throw new Error(
      "No se encontró el paciente. Es posible que haya sido eliminado"
    );
  }

  // Check access
  if (
    session.user.role !== "ADMIN" &&
    patient.clinicId !== session.user.clinicId
  ) {
    throw new Error(
      "No tienes permisos para ver la información de este paciente"
    );
  }

  return patient;
}

export async function searchPatients(query: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewPatients(session.user)) {
    throw new Error("No tienes permisos para buscar pacientes");
  }

  const whereClause: any = {
    isActive: true,
  };

  if (session.user.role !== "ADMIN") {
    whereClause.clinicId = session.user.clinicId;
  }

  // Get all active patients
  const patients = await prisma.patient.findMany({
    where: whereClause,
    include: {
      clinic: true,
      doctor: {
        include: { user: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  // Normalize query: remove accents and convert to uppercase
  const normalizedQuery = removeAccents(query.trim());

  // Split query into words for flexible matching
  const queryWords = normalizedQuery
    .split(/\s+/)
    .filter((word) => word.length > 0);

  // Filter patients by checking if all query words appear in the full name or other fields
  const filteredPatients = patients.filter((patient) => {
    const fullName = removeAccents(
      `${patient.firstName} ${patient.lastName} ${patient.secondLastName || ""}`
    );
    const phone = patient.phone || "";
    const email = removeAccents(patient.email || "");
    const customId = removeAccents(patient.customId || "");

    // Check if all query words appear somewhere in the searchable fields
    return queryWords.every((word) => {
      return (
        fullName.includes(word) ||
        phone.includes(word) ||
        email.includes(word) ||
        customId.includes(word)
      );
    });
  });

  // Limit results
  return filteredPatients.slice(0, 20);
}
