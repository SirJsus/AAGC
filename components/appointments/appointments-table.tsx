"use client";

import { useState } from "react";
import {
  Appointment,
  Patient,
  Doctor,
  Clinic,
  Room,
  AppointmentType,
  AppointmentStatus,
} from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Calendar, Clock, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  formatDateForDisplay,
  formatTimeForDisplay,
  formatDateForInput,
  getCurrentDateInTimezone,
} from "@/lib/utils/timezone";
import { AppointmentBookingDialog } from "./appointment-booking-dialog";
import { AppointmentDetailsDialog } from "./appointment-details-dialog";
import { useRouter } from "next/navigation";
import { getStatusLabel } from "@/lib/utils/appointment-state";
import { useSession } from "next-auth/react";
import { Permissions } from "@/lib/permissions";
import { updateAppointmentStatus } from "@/lib/actions/appointments";

interface AppointmentTypeForClient extends Omit<AppointmentType, "price"> {
  price: number;
}

interface AppointmentWithRelations extends Omit<Appointment, "customPrice"> {
  customPrice?: number | null;
  patient: Patient;
  doctor: Doctor & {
    user: {
      firstName: string;
      lastName: string;
      secondLastName?: string;
      specialty: string;
    };
  };
  clinic?: Clinic | null;
  room?: Room | null;
  appointmentType?: AppointmentTypeForClient | null;
}

interface AppointmentsTableProps {
  appointments: AppointmentWithRelations[];
}

export function AppointmentsTable({ appointments }: AppointmentsTableProps) {
  const router = useRouter();
  const { data: session } = useSession() || {};
  // If the user is a NURSE, restrict displayed appointments to today's date
  const displayedAppointments: AppointmentWithRelations[] = (() => {
    const all = appointments || [];
    try {
      if (session?.user?.role === "NURSE") {
        const today = getCurrentDateInTimezone(); // YYYY-MM-DD in clinic timezone
        return all.filter((a) => {
          // appointment.date can be string or Date
          const dateObj =
            typeof a.date === "string" ? new Date(a.date) : a.date;
          return formatDateForInput(dateObj) === today;
        });
      }
    } catch (e) {
      // If anything goes wrong, fall back to showing all (avoid breaking UI)
      console.error("Error filtering appointments for NURSE:", e);
      return all;
    }

    return all;
  })();

  // Return a patient ID formatted according to the viewer's role.
  // Example: "ABC-DEF-G1" -> for NURSE returns "DEF-G1". Others see full ID.
  const formatPatientIdForUser = (id?: string | null) => {
    const raw = id || "";
    try {
      if (session?.user?.role === "NURSE") {
        const parts = raw.split("-");
        if (parts.length >= 2) {
          return parts.slice(1).join("-");
        }
        return raw;
      }
    } catch (e) {
      console.error("Error formatting patient id for NURSE:", e);
      return raw;
    }

    return raw;
  };
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentWithRelations | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  // Confirmation modal state for cancelling via the trash button
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAppointmentId, setConfirmAppointmentId] = useState<
    string | null
  >(null);
  const [confirmTop, setConfirmTop] = useState<number>(30);
  const [confirmLeft, setConfirmLeft] = useState<number>(30);
  const [buttonsReversed, setButtonsReversed] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleViewDetails = (appointment: AppointmentWithRelations) => {
    setSelectedAppointment(appointment);
    setDetailsDialogOpen(true);
  };

  const handleDeleteAppointment = (appointmentId: string) => {
    // Find the appointment to check its status
    const appt = appointments.find((a) => a.id === appointmentId);
    if (!appt) return;

    // If appointment is already in a terminal state, show inline notification
    if (
      appt.status === AppointmentStatus.COMPLETED ||
      appt.status === AppointmentStatus.CANCELLED
    ) {
      // Use toast to notify user instead of rendering an inline Notification
      toast.error(
        "No puedes modificar una cita que ya está completa o cancelada."
      );
      return;
    }

    // Open confirmation modal at a random position and randomize button order
    const top = Math.floor(Math.random() * 50) + 10; // 10%..60%
    const left = Math.floor(Math.random() * 60) + 10; // 10%..70%
    setConfirmTop(top);
    setConfirmLeft(left);
    setButtonsReversed(Math.random() < 0.5);
    setConfirmAppointmentId(appointmentId);
    setConfirmOpen(true);
  };

  const performCancel = async () => {
    if (!confirmAppointmentId) return;
    setIsCancelling(true);
    try {
      await updateAppointmentStatus(
        confirmAppointmentId,
        AppointmentStatus.CANCELLED,
        "Cancelado desde la lista",
        undefined
      );
      toast.success("Cita cancelada correctamente");
      setConfirmOpen(false);
      setConfirmAppointmentId(null);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al cancelar la cita"
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const handleAppointmentCreated = () => {
    router.refresh();
  };

  const handleAppointmentUpdated = () => {
    router.refresh();
  };

  const getStatusBadgeVariant = (status: AppointmentStatus) => {
    switch (status) {
      case AppointmentStatus.CONFIRMED:
        return "default";
      case AppointmentStatus.PENDING:
        return "secondary";
      case AppointmentStatus.COMPLETED:
        return "default";
      case AppointmentStatus.CANCELLED:
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Appointments ({displayedAppointments?.length || 0})
          </CardTitle>
          {session?.user && Permissions.canCreateAppointments(session.user) && (
            <AppointmentBookingDialog onSuccess={handleAppointmentCreated} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedAppointments?.map((appointment) => (
              <TableRow key={appointment.id}>
                <TableCell className="font-medium">
                  {formatPatientIdForUser(appointment.patient.customId)}
                </TableCell>
                <TableCell className="font-medium">
                  {appointment.patient.firstName} {appointment.patient.lastName}{" "}
                  {appointment.patient.secondLastName || ""}
                </TableCell>
                <TableCell>
                  Dr. {appointment.doctor?.user?.firstName}{" "}
                  {appointment.doctor?.user?.lastName}{" "}
                  {appointment.doctor?.user?.secondLastName || ""}
                </TableCell>
                <TableCell>{formatDateForDisplay(appointment.date)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {formatTimeForDisplay(appointment.startTime)} -{" "}
                    {formatTimeForDisplay(appointment.endTime)}
                  </div>
                </TableCell>
                <TableCell>
                  {appointment.appointmentType?.name ||
                    appointment.customReason ||
                    "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={getStatusBadgeVariant(
                      appointment.status as AppointmentStatus
                    )}
                  >
                    {getStatusLabel(appointment.status as AppointmentStatus)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(appointment)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAppointment(appointment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {(!displayedAppointments || displayedAppointments.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            No appointments found. Schedule your first appointment to get
            started.
          </div>
        )}
      </CardContent>

      {selectedAppointment && (
        <AppointmentDetailsDialog
          appointment={selectedAppointment}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          onSuccess={handleAppointmentUpdated}
        />
      )}

      {/* Custom confirmation modal (fixed positioned with random coords) */}
      {confirmOpen && (
        <div className="fixed z-50 bg-background/80 inset-0 flex items-center justify-center">
          <div className="bg-white rounded-md shadow-lg p-4 w-80 border">
            <h3 className="text-sm font-semibold mb-2">Confirmar acción</h3>
            <p className="text-xs text-muted-foreground mb-4">
              ¿Deseas cancelar esta cita? Esta acción marcará la cita como
              "Cancelada".
            </p>
            <div className="flex justify-end gap-2">
              {buttonsReversed ? (
                <>
                  <Button
                    variant="destructive"
                    onClick={performCancel}
                    disabled={isCancelling}
                  >
                    {isCancelling ? "Cancelando..." : "Confirmar"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setConfirmOpen(false);
                      setConfirmAppointmentId(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setConfirmOpen(false);
                      setConfirmAppointmentId(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={performCancel}
                    disabled={isCancelling}
                  >
                    {isCancelling ? "Cancelando..." : "Confirmar"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
