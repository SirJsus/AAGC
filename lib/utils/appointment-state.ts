import { AppointmentStatus } from "@prisma/client";

/**
 * Flujo de transiciones de estados de citas
 *
 * PENDING (Pendiente) → CONFIRMED (Confirmada), REQUIRES_RESCHEDULE (Requiere Reagendar) o CANCELLED (Cancelada)
 * CONFIRMED (Confirmada) → IN_CONSULTATION (En Consulta), CANCELLED, NO_SHOW (No Asistió), REQUIRES_RESCHEDULE (Requiere Reagendar)
 * IN_CONSULTATION (En Consulta) → PAID (Pagada)
 * PAID (Pagada) → COMPLETED (Completada)
 * REQUIRES_RESCHEDULE (Requiere Reagendar) → PENDING (Pendiente) o CANCELLED (Cancelada)
 *
 * Estados terminales: COMPLETED, CANCELLED, NO_SHOW
 */

// State transition validation
export function isValidStateTransition(
  currentStatus: AppointmentStatus,
  newStatus: AppointmentStatus
): boolean {
  const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
    [AppointmentStatus.PENDING]: [
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.REQUIRES_RESCHEDULE,
      AppointmentStatus.CANCELLED,
    ],
    [AppointmentStatus.CONFIRMED]: [
      AppointmentStatus.IN_CONSULTATION,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
      AppointmentStatus.REQUIRES_RESCHEDULE,
    ],
    [AppointmentStatus.IN_CONSULTATION]: [
      AppointmentStatus.PAID,
      AppointmentStatus.TRANSFER_PENDING,
    ],
    [AppointmentStatus.TRANSFER_PENDING]: [
      AppointmentStatus.PAID,
      AppointmentStatus.CANCELLED,
    ],
    [AppointmentStatus.PAID]: [AppointmentStatus.COMPLETED],
    [AppointmentStatus.COMPLETED]: [], // Terminal state
    [AppointmentStatus.CANCELLED]: [], // Terminal state
    [AppointmentStatus.NO_SHOW]: [], // Terminal state
    [AppointmentStatus.REQUIRES_RESCHEDULE]: [
      AppointmentStatus.PENDING,
      AppointmentStatus.CANCELLED,
    ],
  };

  return transitions[currentStatus]?.includes(newStatus) || false;
}

// Get available state transitions for current status
export function getAvailableTransitions(
  currentStatus: AppointmentStatus
): AppointmentStatus[] {
  const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
    [AppointmentStatus.PENDING]: [
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.REQUIRES_RESCHEDULE,
      AppointmentStatus.CANCELLED,
    ],
    [AppointmentStatus.CONFIRMED]: [
      AppointmentStatus.IN_CONSULTATION,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
      AppointmentStatus.REQUIRES_RESCHEDULE,
    ],
    [AppointmentStatus.IN_CONSULTATION]: [
      AppointmentStatus.PAID,
      AppointmentStatus.TRANSFER_PENDING,
    ],
    [AppointmentStatus.TRANSFER_PENDING]: [
      AppointmentStatus.PAID,
      AppointmentStatus.CANCELLED,
    ],
    [AppointmentStatus.PAID]: [AppointmentStatus.COMPLETED],
    [AppointmentStatus.COMPLETED]: [],
    [AppointmentStatus.CANCELLED]: [],
    [AppointmentStatus.NO_SHOW]: [],
    [AppointmentStatus.REQUIRES_RESCHEDULE]: [
      AppointmentStatus.PENDING,
      AppointmentStatus.CANCELLED,
    ],
  };

  return transitions[currentStatus] || [];
}

// Get status label in Spanish
export function getStatusLabel(status: AppointmentStatus): string {
  const labels: Record<AppointmentStatus, string> = {
    [AppointmentStatus.PENDING]: "Pendiente",
    [AppointmentStatus.CONFIRMED]: "Confirmada",
    [AppointmentStatus.IN_CONSULTATION]: "En Consulta",
    [AppointmentStatus.TRANSFER_PENDING]: "Esperando Confirmación de Pago",
    [AppointmentStatus.PAID]: "Pagada",
    [AppointmentStatus.COMPLETED]: "Completada",
    [AppointmentStatus.CANCELLED]: "Cancelada",
    [AppointmentStatus.NO_SHOW]: "No Asistió",
    [AppointmentStatus.REQUIRES_RESCHEDULE]: "Requiere Reagendar",
  };

  return labels[status] || status;
}

// Get status description
export function getStatusDescription(status: AppointmentStatus): string {
  const descriptions: Record<AppointmentStatus, string> = {
    [AppointmentStatus.PENDING]:
      "La cita ha sido creada pero aún no confirmada por el paciente",
    [AppointmentStatus.CONFIRMED]:
      "El paciente ha confirmado su asistencia a la cita",
    [AppointmentStatus.IN_CONSULTATION]:
      "El doctor está atendiendo al paciente en este momento",
    [AppointmentStatus.TRANSFER_PENDING]:
      "Pago por transferencia en curso. Esperando confirmación bancaria para marcar como pagada.",
    [AppointmentStatus.PAID]: "El paciente ha realizado el pago de la consulta",
    [AppointmentStatus.COMPLETED]:
      "La consulta ha sido completada exitosamente",
    [AppointmentStatus.CANCELLED]: "La cita fue cancelada",
    [AppointmentStatus.NO_SHOW]: "El paciente no asistió a la cita programada",
    [AppointmentStatus.REQUIRES_RESCHEDULE]: "Es necesario reagendar esta cita",
  };

  return descriptions[status] || "";
}

// Get status color class for UI
export function getStatusColorClass(status: AppointmentStatus): string {
  const colors: Record<AppointmentStatus, string> = {
    [AppointmentStatus.PENDING]:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    [AppointmentStatus.CONFIRMED]:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    [AppointmentStatus.IN_CONSULTATION]:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    [AppointmentStatus.TRANSFER_PENDING]:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    [AppointmentStatus.PAID]:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    [AppointmentStatus.COMPLETED]:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    [AppointmentStatus.CANCELLED]:
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    [AppointmentStatus.NO_SHOW]:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    [AppointmentStatus.REQUIRES_RESCHEDULE]:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };

  return (
    colors[status] ||
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
  );
}

// Check if status is terminal (no further transitions allowed)
export function isTerminalStatus(status: AppointmentStatus): boolean {
  const terminalStatuses: AppointmentStatus[] = [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ];
  return terminalStatuses.includes(status);
}
