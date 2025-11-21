"use client";

import { useState, useEffect, useMemo } from "react";
import { AppointmentStatus, Clinic } from "@prisma/client";
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
import { Trash2, Calendar, Clock, Eye, X, Filter, Edit } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  formatDateForDisplay,
  formatTimeForDisplay,
  getCurrentDateInTimezone,
  extractDateInClinicTimezone,
} from "@/lib/utils/timezone";
import { AppointmentBookingDialog } from "./appointment-booking-dialog";
import { AppointmentDetailsDialog } from "./appointment-details-dialog";
import { AppointmentEditDialog } from "./appointment-edit-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { getStatusLabel } from "@/lib/utils/appointment-state";
import { useSession } from "next-auth/react";
import { Permissions } from "@/lib/permissions";
import {
  updateAppointmentStatus,
  hardDeleteAppointment,
} from "@/lib/actions/appointments";
import { AppointmentWithRelations } from "@/types/appointments";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { startOfWeek, endOfWeek } from "date-fns";

interface AppointmentsTableProps {
  appointments: AppointmentWithRelations[];
  clinics?: Clinic[];
}

export function AppointmentsTable({
  appointments,
  clinics = [],
}: AppointmentsTableProps) {
  const router = useRouter();
  const { data: session } = useSession() || {};
  const searchParams = useSearchParams();

  // State for clinic filter
  const [clinicFilter, setClinicFilter] = useState<string>(
    searchParams.get("clinicId") || "all"
  );

  // State for date range filter - defaults to current week
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return {
      from: startOfWeek(today, { weekStartsOn: 0 }), // Sunday
      to: endOfWeek(today, { weekStartsOn: 0 }), // Saturday
    };
  });

  // Function to check if a date falls within the selected range
  const isDateInRange = (
    appointmentDate: Date | string,
    range: DateRange | undefined
  ): boolean => {
    if (!range?.from) return true; // If no range selected, show all

    const dateObj =
      typeof appointmentDate === "string"
        ? new Date(appointmentDate)
        : appointmentDate;
    const dateOnly = new Date(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate()
    );
    const fromDate = new Date(
      range.from.getFullYear(),
      range.from.getMonth(),
      range.from.getDate()
    );

    if (!range.to) {
      // Only 'from' date selected, show appointments on that day
      return dateOnly.getTime() === fromDate.getTime();
    }

    const toDate = new Date(
      range.to.getFullYear(),
      range.to.getMonth(),
      range.to.getDate()
    );
    return dateOnly >= fromDate && dateOnly <= toDate;
  };

  // If the user is a NURSE, restrict displayed appointments to today's date
  // Also apply date range filter for all users
  const displayedAppointments: AppointmentWithRelations[] = useMemo(() => {
    const all = appointments || [];

    // First, filter by date range
    const dateFiltered = all.filter((a) => isDateInRange(a.date, dateRange));

    try {
      if (session?.user?.role === "NURSE") {
        const today = getCurrentDateInTimezone(); // YYYY-MM-DD in clinic timezone
        return dateFiltered.filter((a) => {
          // appointment.date can be string or Date
          const dateObj =
            typeof a.date === "string" ? new Date(a.date) : a.date;
          const timezone = a.clinic?.timezone || "America/Mexico_City";
          return extractDateInClinicTimezone(dateObj, timezone) === today;
        });
      }
    } catch (e) {
      // If anything goes wrong, fall back to showing all (avoid breaking UI)
      console.error("Error filtering appointments for NURSE:", e);
      return dateFiltered;
    }

    return dateFiltered;
  }, [appointments, dateRange, session?.user?.role]);

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAppointment, setEditAppointment] =
    useState<AppointmentWithRelations | null>(null);
  // Confirmation modal state for cancelling via the trash button
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAppointmentId, setConfirmAppointmentId] = useState<
    string | null
  >(null);
  // State for permanent deletion confirmation
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmTop, setConfirmTop] = useState<number>(30);
  const [confirmLeft, setConfirmLeft] = useState<number>(30);
  const [buttonsReversed, setButtonsReversed] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleViewDetails = (appointment: AppointmentWithRelations) => {
    setSelectedAppointment(appointment);
    setDetailsDialogOpen(true);
  };

  const handleEditAppointment = (appointment: AppointmentWithRelations) => {
    setEditAppointment(appointment);
    setEditDialogOpen(true);
  };

  const handlePermanentDelete = (appointmentId: string) => {
    setConfirmDeleteId(appointmentId);
    setConfirmDeleteOpen(true);
  };

  const performPermanentDelete = async () => {
    if (!confirmDeleteId) return;
    setIsDeleting(true);
    try {
      await hardDeleteAppointment(confirmDeleteId);
      toast.success("Cita eliminada permanentemente");
      setConfirmDeleteOpen(false);
      setConfirmDeleteId(null);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar la cita"
      );
    } finally {
      setIsDeleting(false);
    }
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

  const updateClinicFilter = (value: string) => {
    setClinicFilter(value);
    const params = new URLSearchParams(window.location.search);
    if (value === "all") {
      params.delete("clinicId");
    } else {
      params.set("clinicId", value);
    }
    router.push(`/appointments?${params.toString()}`);
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
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Appointments ({displayedAppointments?.length || 0})
          </CardTitle>
          {session?.user && Permissions.canCreateAppointments(session.user) && (
            <AppointmentBookingDialog onSuccess={handleAppointmentCreated} />
          )}
        </div>
        <div className="space-y-2">
          {/* Clinic Filter (only for ADMIN) */}
          {session?.user?.role === "ADMIN" && clinics.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={clinicFilter} onValueChange={updateClinicFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Clínica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las clínicas</SelectItem>
                  {clinics.map((clinic) => (
                    <SelectItem key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <DateRangePicker
              value={dateRange as DateRange}
              onChange={(range) => setDateRange(range)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                setDateRange({
                  from: startOfWeek(today, { weekStartsOn: 0 }),
                  to: endOfWeek(today, { weekStartsOn: 0 }),
                });
              }}
            >
              Esta semana
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateRange(undefined)}
            >
              <X className="h-4 w-4 mr-1" />
              Limpiar filtro
            </Button>
          </div>
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
                <TableCell>
                  {(() => {
                    const timezone =
                      appointment.clinic?.timezone || "America/Mexico_City";
                    const displayDate = formatDateForDisplay(
                      appointment.date,
                      timezone
                    );
                    return displayDate;
                  })()}
                </TableCell>
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
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {session?.user &&
                      Permissions.canEditAppointments(session.user) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditAppointment(appointment)}
                          title="Editar cita"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    {session?.user &&
                    Permissions.canDeleteAppointments(session.user) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePermanentDelete(appointment.id)}
                        className="text-destructive hover:text-destructive"
                        title="Eliminar permanentemente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAppointment(appointment.id)}
                        title="Cancelar cita"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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

      {editAppointment && (
        <AppointmentEditDialog
          appointment={editAppointment}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={handleAppointmentUpdated}
        />
      )}

      {/* Custom confirmation modal for permanent deletion */}
      {confirmDeleteOpen && (
        <div className="fixed z-50 bg-background/80 inset-0 flex items-center justify-center">
          <div className="bg-white rounded-md shadow-lg p-6 w-96 border border-destructive">
            <h3 className="text-lg font-semibold mb-2 text-destructive">
              ⚠️ Eliminar permanentemente
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Esta acción <strong>eliminará completamente</strong> la cita de la
              base de datos y <strong>no se puede deshacer</strong>. ¿Estás
              seguro de que deseas continuar?
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmDeleteOpen(false);
                  setConfirmDeleteId(null);
                }}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={performPermanentDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Eliminando..." : "Eliminar permanentemente"}
              </Button>
            </div>
          </div>
        </div>
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
