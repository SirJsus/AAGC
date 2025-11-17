/**
 * Shared type definitions for appointment components
 * These types represent serialized data from server to client (Decimal -> number, Date -> Date|string)
 */

import {
  Appointment,
  Patient,
  Doctor,
  Clinic,
  Room,
  AppointmentType,
  Specialty,
} from "@prisma/client";

// AppointmentType with price as number (converted from Decimal)
export interface AppointmentTypeForClient
  extends Omit<AppointmentType, "price"> {
  price: number;
}

// Appointment with all Date fields that might be serialized and customPrice as number
export interface AppointmentWithRelations
  extends Omit<Appointment, "customPrice"> {
  customPrice: number | null;
  patient: Patient;
  doctor: Doctor & {
    user: {
      firstName: string;
      lastName: string;
      secondLastName?: string;
    };
    specialties?: Array<{
      specialty: Specialty;
      isPrimary: boolean;
    }>;
  };
  clinic: Clinic | null;
  room: Room | null;
  appointmentType: AppointmentTypeForClient | null;
}
