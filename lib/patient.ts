import { Patient } from "@prisma/client";

// Calcula la edad en años dada una fecha en formato YYYY-MM-DD
export function calculateAge(dateString?: string | null): number | null {
  if (!dateString) return null;
  const parts = dateString.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const dob = new Date(year, month, day);
  if (isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export function getPatientEssentials(patient: Patient) {
  const names = [patient.firstName, patient.lastName, patient.secondLastName]
    .filter(Boolean)
    .join(" ");

  const birthDateStr = patient.birthDate
    ? new Date(patient.birthDate).toISOString().split("T")[0]
    : undefined;

  return {
    fullName: names || "",
    customId: patient.customId || "",
    phone: patient.phone || "",
    birthDate: birthDateStr,
    age: calculateAge(birthDateStr ?? null),
    gender: patient.gender,
  };
}

export default {
  calculateAge,
  getPatientEssentials,
};
