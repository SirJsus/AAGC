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
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  secondLastName: z.string().optional(),
  noSecondLastName: z.boolean().optional(),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")),
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
});

export async function createPatient(data: z.infer<typeof createPatientSchema>) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canManagePatients(session.user)) {
    throw new Error("Unauthorized");
  }

  const validatedData = createPatientSchema.parse(data);

  // Get clinic for patient acronym and counter
  let clinic = null;

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

  if (!clinic) {
    throw new Error("No active clinic found");
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
      `CustomId collision detected. Please try again. (${customId}-${timestamp})`
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
    throw new Error("Unauthorized");
  }

  // Get clinic
  let clinic = null;
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
    throw new Error("Unauthorized");
  }

  const validatedData = createPatientSchema.parse(data);

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
      pendingCompletion: !hasCompleteData, // Mark as completed when all required data is present
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
    throw new Error("Unauthorized");
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

export async function getPatients() {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewPatients(session.user)) {
    throw new Error("Unauthorized");
  }

  // For doctors, only show patients they have attended
  if (session.user.role === "DOCTOR") {
    // Get the doctor record for this user
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.user.id },
    });

    if (!doctor) {
      return [];
    }

    // Get all unique patient IDs from appointments with this doctor
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        patient: {
          isActive: true,
        },
      },
      select: {
        patientId: true,
      },
      distinct: ["patientId"],
    });

    const patientIds = appointments.map((a) => a.patientId);

    if (patientIds.length === 0) {
      return [];
    }

    const patients = await prisma.patient.findMany({
      where: {
        id: { in: patientIds },
        isActive: true,
      },
      include: {
        clinic: true,
        doctor: {
          include: { user: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return patients;
  }

  // For other roles, show all patients in their clinic
  const whereClause =
    session.user.role === "ADMIN"
      ? { isActive: true }
      : {
          isActive: true,
          clinicId: session.user.clinicId || "",
        };

  const patients = await prisma.patient.findMany({
    where: whereClause,
    include: {
      clinic: true,
      doctor: {
        include: { user: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 500, // Limit for performance
  });

  return patients;
}

export async function getPatient(id: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewPatients(session.user)) {
    throw new Error("Unauthorized");
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
    throw new Error("Patient not found");
  }

  // Check access
  if (
    session.user.role !== "ADMIN" &&
    patient.clinicId !== session.user.clinicId
  ) {
    throw new Error("Unauthorized to view this patient");
  }

  return patient;
}

export async function searchPatients(query: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canViewPatients(session.user)) {
    throw new Error("Unauthorized");
  }

  const whereClause: any = {
    isActive: true,
    OR: [
      { firstName: { contains: query, mode: "insensitive" } },
      { lastName: { contains: query, mode: "insensitive" } },
      { secondLastName: { contains: query, mode: "insensitive" } },
      { phone: { contains: query } },
      { email: { contains: query, mode: "insensitive" } },
      { customId: { contains: query, mode: "insensitive" } },
    ],
  };

  if (session.user.role !== "ADMIN") {
    whereClause.clinicId = session.user.clinicId;
  }

  const patients = await prisma.patient.findMany({
    where: whereClause,
    include: {
      clinic: true,
      doctor: {
        include: { user: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 20, // Limit search results
  });

  return patients;
}
