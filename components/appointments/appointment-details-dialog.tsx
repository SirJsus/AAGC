"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  MapPin,
  DollarSign,
  FileText,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { getPatientEssentials } from "@/lib/patient";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import {
  Appointment,
  Patient,
  Doctor,
  Clinic,
  Room,
  AppointmentType,
  AppointmentStatus,
  PaymentMethod,
} from "@prisma/client";
import {
  formatDateForDisplay,
  formatTimeForDisplay,
  formatDateForInput,
  formatDateToString,
  extractDateInClinicTimezone,
} from "@/lib/utils/timezone";
import {
  updateAppointmentStatus,
  updateAppointment,
} from "@/lib/actions/appointments";
import { createAppointment } from "@/lib/actions/appointments";
import { getDoctorExceptions } from "@/lib/actions/doctor-schedules";
import {
  getDoctors,
  getDoctorByUserId,
  getDoctor,
} from "@/lib/actions/doctors";
import {
  getAvailableTransitions,
  getStatusLabel,
  getStatusDescription,
  getStatusColorClass,
  isTerminalStatus,
} from "@/lib/utils/appointment-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { SlotPicker } from "./slot-picker";

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

interface AppointmentDetailsDialogProps {
  appointment: AppointmentWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AppointmentDetailsDialog({
  appointment,
  open,
  onOpenChange,
  onSuccess,
}: AppointmentDetailsDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedNewStatus, setSelectedNewStatus] =
    useState<AppointmentStatus | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [notes, setNotes] = useState(appointment.notes || "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentCustomEnabled, setPaymentCustomEnabled] = useState(false);
  const [showPendingError, setShowPendingError] = useState(false);

  // localCustomPrice mirrors a custom price that may have been applied during
  // the dialog's lifecycle (e.g., when marking as PAID with a custom amount).
  // We keep this separate from the prop so the UI can immediately prefer the
  // custom price even before the parent refreshes the appointment prop.
  const [localCustomPrice, setLocalCustomPrice] = useState<number | null>(
    appointment.customPrice ?? null
  );

  // localStatus mirrors the appointment status inside the dialog so we can
  // reflect transitions immediately without waiting for the parent to refresh
  const [localStatus, setLocalStatus] = useState<AppointmentStatus>(
    appointment.status as AppointmentStatus
  );

  const isTransferPending = localStatus === AppointmentStatus.TRANSFER_PENDING;

  // Datos esenciales del paciente (nombre completo, id, teléfono, edad)
  const patientEssentials = getPatientEssentials(appointment.patient);

  // Reschedule mode
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [doctors, setDoctors] = useState<
    Array<
      Doctor & {
        user: {
          firstName: string;
          lastName: string;
          secondLastName: string | null;
          specialty: string;
        };
      }
    >
  >([]);
  const [selectedDoctor, setSelectedDoctor] = useState(appointment.doctorId);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);

  // Follow-up (create new appointment when marking as COMPLETED)
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [followUpDoctor, setFollowUpDoctor] = useState<string | null>(
    appointment.doctorId
  );
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);
  const [followUpSlot, setFollowUpSlot] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);
  // Confirmation modal for creating follow-up
  const [showConfirm, setShowConfirm] = useState(false);

  // Availability state: dates with no available slots for the selected doctor
  const [unavailableDates, setUnavailableDates] = useState<Set<string>>(
    new Set()
  );
  // Weekdays (0-6) that the selected doctor does NOT work
  const [nonWorkingWeekdays, setNonWorkingWeekdays] = useState<Set<number>>(
    new Set()
  );

  // Use localStatus for available transitions so the dialog updates immediately
  let availableTransitions = getAvailableTransitions(localStatus);
  // Si la cita requiere reagendar, desde el diálogo sólo permitimos cancelar.
  // La acción de reagendar (cuando se confirma) ya cambia el estado a PENDING
  // en el backend, por lo que no mostramos PENDING aquí.
  if (localStatus === AppointmentStatus.REQUIRES_RESCHEDULE) {
    availableTransitions = [AppointmentStatus.CANCELLED];
  }
  const isTerminal = isTerminalStatus(localStatus as AppointmentStatus);
  const canReschedule = localStatus === AppointmentStatus.REQUIRES_RESCHEDULE;

  useEffect(() => {
    if (open && canReschedule) {
      loadDoctors();
    }
  }, [open, canReschedule]);

  // Keep localStatus in sync when the parent updates the appointment prop
  useEffect(() => {
    setLocalStatus(appointment.status as AppointmentStatus);
  }, [appointment.status]);

  // Ensure doctors are loaded for follow-up creation when dialog opens
  useEffect(() => {
    if (open && doctors.length === 0) {
      loadDoctors();
    }
    // reset follow-up fields when appointment changes
    setCreateFollowUp(false);
    setFollowUpDoctor(appointment.doctorId);
    setFollowUpDate(undefined);
    setFollowUpSlot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment.id]);

  // Reset local UI state when the dialog context changes to a different appointment
  // (e.g., user moves from appointment A to appointment B while the dialog remains open).
  useEffect(() => {
    // Reset fields to the defaults based on the new appointment
    setIsUpdating(false);
    setSelectedNewStatus(null);
    setCancelReason("");
    setNotes(appointment.notes || "");
    setShowPendingError(false);

    setIsRescheduling(false);
    setDoctors([]);
    setSelectedDoctor(appointment.doctorId);
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setUnavailableDates(new Set());
    setNonWorkingWeekdays(new Set());
    // Initialize payment fields from appointment if present
    setPaymentMethod((appointment as any).paymentMethod || "");
    setPaymentConfirmed(!!(appointment as any).paymentConfirmed);
    setPaymentAmount("");
    setPaymentCustomEnabled(false);

    // sync local custom price to the incoming appointment
    setLocalCustomPrice((appointment as any).customPrice ?? null);

    // If the new appointment can be rescheduled and the dialog is open, load doctors/availability
    if (open && localStatus === AppointmentStatus.REQUIRES_RESCHEDULE) {
      // loadDoctors will also call loadAvailabilityForRange for doctor users
      loadDoctors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment.id]);

  // When an appointment is TRANSFER_PENDING and the transfer is confirmed
  // by checking the box, auto-select PAID as the new status so the user
  // can immediately apply the transition.
  useEffect(() => {
    if (
      isTransferPending &&
      paymentConfirmed &&
      selectedNewStatus !== AppointmentStatus.PAID
    ) {
      setSelectedNewStatus(AppointmentStatus.PAID);
    }
  }, [isTransferPending, paymentConfirmed, selectedNewStatus]);

  // Prefill payment amount only when the user enables the custom price checkbox
  useEffect(() => {
    if (paymentCustomEnabled) {
      const prefill =
        localCustomPrice ??
        (appointment as any).customPrice ??
        appointment.appointmentType?.price ??
        0;
      setPaymentAmount(
        prefill !== null && typeof prefill !== "undefined"
          ? String(prefill)
          : ""
      );
    } else {
      // clear the input when disabled to avoid accidental sends
      setPaymentAmount("");
    }
  }, [paymentCustomEnabled, appointment, localCustomPrice]);

  // Validation: currency with up to 2 decimals when custom price enabled
  const paymentAmountRegex = /^\d+(?:\.\d{1,2})?$/;
  const isPaymentAmountValid = paymentCustomEnabled
    ? paymentAmount.trim() !== "" && paymentAmountRegex.test(paymentAmount)
    : true;

  // Live preview of the parsed/rounded amount (string with 2 decimals) when valid
  const liveParsedAmount =
    paymentCustomEnabled && isPaymentAmountValid && paymentAmount.trim() !== ""
      ? (Math.round(parseFloat(paymentAmount) * 100) / 100).toFixed(2)
      : null;

  useEffect(() => {
    if (open && canReschedule && selectedDoctor) {
      loadAvailabilityForRange(selectedDoctor);
    }
    // Also load availability for follow-up doctor selection
    if (open && createFollowUp && followUpDoctor) {
      loadAvailabilityForRange(followUpDoctor);
    }
  }, [open, canReschedule, selectedDoctor, createFollowUp, followUpDoctor]);

  const { data: session } = useSession() || {};
  const isNurse = session?.user?.role === "NURSE";

  const loadDoctors = async () => {
    try {
      // If current user is a DOCTOR, load only their doctor record and auto-select it
      if (session?.user && session.user.role === "DOCTOR") {
        const doc = await getDoctorByUserId();
        const mapped = {
          ...doc,
          user: {
            ...doc.user,
            specialty: doc.user.specialty ?? "",
          },
        } as any;
        setDoctors([mapped]);
        setSelectedDoctor(mapped.id);
        // Immediately load availability for this doctor to avoid load-order race
        await loadAvailabilityForRange(mapped.id);
        return;
      }

      const data = await getDoctors();
      // Ensure user.specialty is always a string (not null)
      const mappedDoctors = data.map((doctor: any) => ({
        ...doctor,
        user: {
          ...doctor.user,
          specialty: doctor.user.specialty ?? "",
        },
      }));
      setDoctors(mappedDoctors);
    } catch (error) {
      toast.error("Error al cargar doctores");
    }
  };

  const loadAvailabilityForRange = async (doctorId: string) => {
    try {
      // Fetch doctor details (including schedules) directly from server to avoid
      // relying on local `doctors` state (prevents race conditions where state
      // hasn't updated yet and all days appear unavailable).
      const doctorObj = await getDoctor(doctorId);
      const workingWeekdays = new Set<number>();
      if (doctorObj && Array.isArray(doctorObj.schedules)) {
        doctorObj.schedules.forEach((s: any) => {
          // schedules.weekday uses 0 (Sunday) - 6 (Saturday)
          if (typeof s.weekday === "number") workingWeekdays.add(s.weekday);
        });
      }

      // non-working weekdays = all days 0..6 minus workingWeekdays
      const nonWorking = new Set<number>();
      for (let i = 0; i < 7; i++) {
        if (!workingWeekdays.has(i)) nonWorking.add(i);
      }
      setNonWorkingWeekdays(nonWorking);

      // Load explicit exceptions (dates) from server for next 30 days
      const today = new Date();
      const start = new Date(today);
      const end = new Date(today);
      end.setDate(end.getDate() + 30);
      const timezone = appointment.clinic?.timezone || "America/Mexico_City";
      const startString = formatDateToString(start, timezone);

      // Prefer to fetch exceptions (only days with exceptions), rather than full availability per day
      const exceptions = await getDoctorExceptions(doctorId, startString);
      const unavailable = new Set<string>();
      if (Array.isArray(exceptions)) {
        exceptions.forEach((ex: any) => {
          // Only mark the whole day as unavailable when the exception has no start/end (full-day block)
          if (ex.date && !ex.startTime && !ex.endTime) unavailable.add(ex.date);
        });
      }
      setUnavailableDates(unavailable);
    } catch (err) {
      console.error("Error loading availability range:", err);
      toast.error("Error al cargar disponibilidad del doctor");
    }
  };

  const handleStatusChange = async () => {
    if (!selectedNewStatus) {
      toast.error("Por favor selecciona un nuevo estado");
      return;
    }

    // Restricción: no permitir avanzar a EN_CONSULTA si el paciente está incompleto
    if (
      selectedNewStatus === AppointmentStatus.IN_CONSULTATION &&
      appointment.patient.pendingCompletion
    ) {
      setShowPendingError(true);
      toast.error(
        "No puedes iniciar la consulta porque el paciente tiene datos pendientes por completar."
      );
      return;
    } else {
      setShowPendingError(false);
    }

    if (
      selectedNewStatus === AppointmentStatus.CANCELLED &&
      !cancelReason.trim()
    ) {
      toast.error("Por favor proporciona un motivo de cancelación");
      return;
    }

    // If marking as PAID, require a payment method to be selected
    if (selectedNewStatus === AppointmentStatus.PAID && !paymentMethod) {
      toast.error(
        "Por favor selecciona un método de pago al marcar como Pagada"
      );
      return;
    }

    // If appointment is currently TRANSFER_PENDING, require confirmation
    if (
      localStatus === AppointmentStatus.TRANSFER_PENDING &&
      !paymentConfirmed
    ) {
      toast.error(
        "La cita está en 'Esperando Confirmación de Pago'. Marca la casilla de confirmación antes de cambiar el estado."
      );
      return;
    }

    // Ensure that when coming from TRANSFER_PENDING we always attempt to set PAID
    const effectiveNewStatus =
      localStatus === AppointmentStatus.TRANSFER_PENDING
        ? AppointmentStatus.PAID
        : selectedNewStatus;

    // NOTE: Removed special-case restriction that prevented marking a
    // REQUIRES_RESCHEDULE appointment as PENDING from the dialog. When the
    // user confirms a reschedule via the reschedule controls, the backend
    // will set the appointment to PENDING automatically. From the dialog
    // we only present the Cancel action for REQUIRES_RESCHEDULE (see
    // availableTransitions override above).

    setIsUpdating(true);
    try {
      // If custom price enabled, validate client-side (required + 2 decimals)
      if (paymentCustomEnabled) {
        if (paymentAmount.toString().trim() === "") {
          toast.error(
            "Por favor ingresa un importe o desactiva 'Precio Personalizado'."
          );
          setIsUpdating(false);
          return;
        }
        if (!paymentAmountRegex.test(paymentAmount)) {
          toast.error(
            "El importe debe ser un número válido con hasta 2 decimales."
          );
          setIsUpdating(false);
          return;
        }
      }

      // Parse and round to 2 decimals if provided
      const parsedAmount =
        paymentCustomEnabled &&
        paymentAmount &&
        paymentAmount.toString().trim() !== ""
          ? Math.round(parseFloat(paymentAmount) * 100) / 100
          : undefined;

      const updated = await updateAppointmentStatus(
        appointment.id,
        effectiveNewStatus!,
        effectiveNewStatus === AppointmentStatus.CANCELLED
          ? cancelReason
          : undefined,
        notes || undefined,
        // If moving to PAID, pass payment info (if selected)
        paymentMethod || undefined,
        paymentConfirmed,
        parsedAmount
      );
      toast.success("Estado de cita actualizado exitosamente");

      // Use server response as source-of-truth to sync local UI
      setLocalStatus(updated.status as AppointmentStatus);
      setNotes(updated.notes || "");
      setPaymentMethod((updated as any).paymentMethod || "");
      setPaymentConfirmed(!!(updated as any).paymentConfirmed);
      setPaymentAmount(
        typeof (updated as any).customPrice !== "undefined" &&
          (updated as any).customPrice !== null
          ? String((updated as any).customPrice)
          : ""
      );

      // Update the local custom price so UI prefers it immediately
      setLocalCustomPrice(
        typeof (updated as any).customPrice === "number"
          ? (updated as any).customPrice
          : null
      );

      // If the new status returned by the server is terminal, close the dialog
      if (isTerminalStatus(updated.status as AppointmentStatus)) {
        onOpenChange(false);
      }

      // If the server marked the appointment as COMPLETED and the user requested a follow-up,
      // create the follow-up appointment now. Use the server-returned status to decide.
      if (updated.status === AppointmentStatus.COMPLETED && createFollowUp) {
        if (!followUpDoctor || !followUpDate || !followUpSlot) {
          toast.error(
            "Por favor selecciona doctor, fecha y hora para la nueva cita"
          );
        } else {
          try {
            const timezone =
              appointment.clinic?.timezone || "America/Mexico_City";
            await createAppointment({
              patientId: appointment.patientId,
              doctorId: followUpDoctor,
              date: formatDateForInput(followUpDate, timezone),
              startTime: followUpSlot.startTime,
              endTime: followUpSlot.endTime,
              appointmentTypeId: appointment.appointmentTypeId || undefined,
              roomId: appointment.roomId || undefined,
              customReason: appointment.customReason || undefined,
              customPrice: appointment.customPrice || undefined,
              notes: notes || undefined,
            });
            toast.success("Nueva cita creada exitosamente");
          } catch (err) {
            toast.error(
              err instanceof Error
                ? err.message
                : "Error al crear la nueva cita"
            );
          }
        }
      }

      setSelectedNewStatus(null);
      setCancelReason("");
      setPaymentMethod("");
      setPaymentConfirmed(false);
      setCreateFollowUp(false);
      setFollowUpDoctor(appointment.doctorId);
      setFollowUpDate(undefined);
      setFollowUpSlot(null);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al actualizar el estado"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle click from the UI: if creating follow-up and COMPLETED, show confirmation first
  const handleAttemptSubmit = async () => {
    if (selectedNewStatus === AppointmentStatus.COMPLETED && createFollowUp) {
      // Ensure follow-up fields are present before showing confirm
      if (!followUpDoctor || !followUpDate || !followUpSlot) {
        toast.error(
          "Por favor selecciona doctor, fecha y hora para la nueva cita"
        );
        return;
      }
      setShowConfirm(true);
      return;
    }

    // Otherwise proceed directly
    await handleStatusChange();
  };

  const handleReschedule = async () => {
    if (!selectedDoctor || !selectedDate || !selectedSlot) {
      toast.error("Por favor selecciona doctor, fecha y hora");
      return;
    }

    setIsUpdating(true);
    try {
      const timezone = appointment.clinic?.timezone || "America/Mexico_City";
      const updated = await updateAppointment(appointment.id, {
        patientId: appointment.patientId,
        doctorId: selectedDoctor,
        date: formatDateForInput(selectedDate, timezone),
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        appointmentTypeId: appointment.appointmentTypeId || undefined,
        roomId: appointment.roomId || undefined,
        customReason: appointment.customReason || undefined,
        customPrice: appointment.customPrice || undefined,
        notes: notes || undefined,
      });
      toast.success("Cita reagendada exitosamente");
      setIsRescheduling(false);
      // Sync local UI from server response
      setLocalStatus(updated.status as AppointmentStatus);
      setNotes(updated.notes || "");
      setPaymentMethod((updated as any).paymentMethod || "");
      setPaymentConfirmed(!!(updated as any).paymentConfirmed);
      setPaymentAmount(
        typeof (updated as any).customPrice !== "undefined" &&
          (updated as any).customPrice !== null
          ? String((updated as any).customPrice)
          : ""
      );
      // Sync local custom price too
      setLocalCustomPrice(
        typeof (updated as any).customPrice === "number"
          ? (updated as any).customPrice
          : null
      );
      onSuccess?.();
      // close only if server-returned status is terminal
      if (isTerminalStatus(updated.status as AppointmentStatus)) {
        onOpenChange(false);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al reagendar"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const getAppointmentTypeInfo = () => {
    if (appointment.appointmentType) {
      return {
        name: appointment.appointmentType.name,
        // Prefer a local/custom price if present (applied at payment time)
        price:
          typeof localCustomPrice === "number"
            ? localCustomPrice
            : appointment.appointmentType.price,
        duration: appointment.appointmentType.durationMin,
      };
    }
    if (appointment.customReason || appointment.customPrice) {
      return {
        name: appointment.customReason || "Consulta personalizada",
        // prefer localCustomPrice if present (updated after custom payment)
        price:
          typeof localCustomPrice === "number"
            ? localCustomPrice
            : appointment.customPrice || 0,
        duration: null,
      };
    }
    return null;
  };

  const appointmentTypeInfo = getAppointmentTypeInfo();

  const paymentMethodLabel = (m: PaymentMethod | "" | undefined) => {
    switch (m) {
      case "CASH":
        return "Efectivo";
      case "DEBIT_CARD":
        return "Tarjeta Débito";
      case "CREDIT_CARD":
        return "Tarjeta Crédito";
      case "TRANSFER":
        return "Transferencia";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-3xl max-h-[90vh] overflow-y-auto ${
          isTerminal ? "max-h-[90vh]" : ""
        }`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalles de la Cita
            <Badge className={getStatusColorClass(localStatus)}>
              {getStatusLabel(localStatus)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {getStatusDescription(localStatus)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Reschedule Section */}
          {canReschedule && !isNurse && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  Reagendar Cita
                  {!isRescheduling && (
                    <Button onClick={() => setIsRescheduling(true)} size="sm">
                      Cambiar Fecha/Doctor
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              {isRescheduling && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="doctorReschedule">Doctor</Label>
                    <Select
                      value={selectedDoctor}
                      onValueChange={(value) => {
                        setSelectedDoctor(value);
                        setSelectedDate(undefined);
                        setSelectedSlot(null);
                      }}
                      disabled={session?.user && session.user.role === "DOCTOR"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        {doctors.map((doctor) => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            Dr. {doctor.user.firstName} {doctor.user.lastName}{" "}
                            {doctor.user.secondLastName || ""}{" "}
                            {doctor.user.specialty &&
                              `- ${doctor.user.specialty}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {session?.user && session.user.role === "DOCTOR" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Estás accediendo como médico — sólo puedes usar tu
                        propio perfil para reagendar.
                      </p>
                    )}
                  </div>

                  {selectedDoctor && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Fecha</Label>
                        <CalendarComponent
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            setSelectedDate(date);
                            setSelectedSlot(null);
                          }}
                          disabled={(date) => {
                            const today = new Date(
                              new Date().setHours(0, 0, 0, 0)
                            );
                            const timezone =
                              appointment.clinic?.timezone ||
                              "America/Mexico_City";
                            const key = formatDateToString(
                              date as Date,
                              timezone
                            );
                            const weekday = (date as Date).getDay();
                            return (
                              date < today ||
                              unavailableDates.has(key) ||
                              nonWorkingWeekdays.has(weekday)
                            );
                          }}
                          className="rounded-md border"
                        />
                      </div>

                      {selectedDate && (
                        <div>
                          <Label>Horario</Label>
                          <SlotPicker
                            doctorId={selectedDoctor}
                            clinicId={appointment.clinicId}
                            date={formatDateForInput(
                              selectedDate,
                              appointment.clinic?.timezone ||
                                "America/Mexico_City"
                            )}
                            appointmentDurationMin={
                              appointment.appointmentType?.durationMin || 30
                            }
                            selectedSlot={selectedSlot}
                            onSlotSelect={setSelectedSlot}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsRescheduling(false);
                        setSelectedDoctor(appointment.doctorId);
                        setSelectedDate(undefined);
                        setSelectedSlot(null);
                      }}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleReschedule}
                      disabled={
                        isUpdating ||
                        !selectedDoctor ||
                        !selectedDate ||
                        !selectedSlot
                      }
                      className="flex-1"
                    >
                      {isUpdating ? "Reagendando..." : "Confirmar Reagendación"}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`space-y-6 ${isTerminal ? "md:col-span-2" : ""}`}>
              {/* Appointment Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Información de la Cita
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Paciente
                        </p>
                        <p className="text-sm font-semibold">
                          {patientEssentials.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(() => {
                            switch (patientEssentials.gender) {
                              case "MALE":
                                return "Masculino";
                              case "FEMALE":
                                return "Femenino";
                              case "OTHER":
                                return "Otro";
                              default:
                                return "No especificado";
                            }
                          })()}
                          {" - "}
                          {patientEssentials.age !== null
                            ? `${patientEssentials.age} años`
                            : "N/A"}{" "}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {patientEssentials.customId}
                        </p>
                        {patientEssentials.phone && (
                          <p className="text-xs text-muted-foreground">
                            {patientEssentials.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Stethoscope className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Doctor
                      </p>
                      <p className="text-sm font-semibold">
                        Dr. {appointment.doctor.user.firstName}{" "}
                        {appointment.doctor.user.lastName}{" "}
                        {appointment.doctor.user.secondLastName || ""}
                      </p>
                      {appointment.doctor.user.specialty && (
                        <p className="text-xs text-muted-foreground">
                          {appointment.doctor.user.specialty}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Fecha
                      </p>
                      <p className="text-sm font-semibold">
                        {formatDateForDisplay(appointment.date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Horario
                      </p>
                      <p className="text-sm font-semibold">
                        {formatTimeForDisplay(appointment.startTime)} -{" "}
                        {formatTimeForDisplay(appointment.endTime)}
                      </p>
                    </div>
                  </div>

                  {appointment.room && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Consultorio
                        </p>
                        <p className="text-sm font-semibold">
                          {appointment.room.name}
                        </p>
                      </div>
                    </div>
                  )}

                  {appointmentTypeInfo && (
                    <>
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Motivo de Consulta
                          </p>
                          <p className="text-sm font-semibold">
                            {appointmentTypeInfo.name}
                          </p>
                          {appointmentTypeInfo.duration && (
                            <p className="text-xs text-muted-foreground">
                              {appointmentTypeInfo.duration} minutos
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex items-start gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Costo
                      </p>
                      <p className="text-sm font-semibold">
                        ${appointmentTypeInfo ? appointmentTypeInfo.price : "0"}
                      </p>
                    </div>
                  </div>
                  {(appointment as any).paymentMethod && (
                    <div className="flex items-start gap-3">
                      {(() => {
                        const pm = (appointment as any).paymentMethod as any;
                        switch (pm) {
                          case PaymentMethod.CREDIT_CARD:
                          case "CREDIT_CARD":
                          case PaymentMethod.DEBIT_CARD:
                          case "DEBIT_CARD":
                            return (
                              <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                            );
                          case PaymentMethod.TRANSFER:
                          case "TRANSFER":
                            // Reuse FileText as transfer icon (lucide doesn't export Bank here)
                            return (
                              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                            );
                          case PaymentMethod.CASH:
                          case "CASH":
                          default:
                            return (
                              <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                            );
                        }
                      })()}

                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Método de Pago
                        </p>
                        <p className="text-sm font-semibold">
                          {paymentMethodLabel(
                            (appointment as any).paymentMethod
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(appointment as any).paymentConfirmed
                            ? "Confirmado"
                            : "Pendiente de confirmación"}
                        </p>
                      </div>
                    </div>
                  )}

                  {appointment.cancelReason && (
                    <>
                      <Separator />
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <p className="font-medium">Motivo de Cancelación:</p>
                          <p>{appointment.cancelReason}</p>
                        </AlertDescription>
                      </Alert>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              {/* For NURSE users we still show Notes as read-only even though
                  the state transition controls are hidden. */}
              {isNurse && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Notas Adicionales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {notes ? (
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {notes}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </CardContent>
                </Card>
              )}
              {/* State Transition */}
              {!isNurse && !isTerminal && availableTransitions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Cambiar Estado de la Cita
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newStatus">Nuevo Estado</Label>
                      <Select
                        value={selectedNewStatus || ""}
                        onValueChange={(value) => {
                          setSelectedNewStatus(value as AppointmentStatus);
                          setShowPendingError(false);
                        }}
                        disabled={isTransferPending && !paymentConfirmed}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona el nuevo estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTransitions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {getStatusLabel(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {showPendingError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No puedes iniciar la consulta porque el paciente tiene
                          datos pendientes por completar. Por favor edita el
                          paciente y completa la información antes de continuar.
                        </AlertDescription>
                      </Alert>
                    )}
                    {selectedNewStatus === AppointmentStatus.CANCELLED && (
                      <div className="space-y-2">
                        <Label htmlFor="cancelReason">
                          Motivo de Cancelación{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          id="cancelReason"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Explica el motivo de la cancelación..."
                          rows={3}
                        />
                      </div>
                    )}
                    {selectedNewStatus === AppointmentStatus.PAID &&
                      !isTransferPending && (
                        <div className="space-y-2">
                          <Label htmlFor="paymentMethod">Método de Pago</Label>
                          <Select
                            value={paymentMethod || ""}
                            onValueChange={(v) =>
                              setPaymentMethod(v as PaymentMethod)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona método de pago" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CASH">Efectivo</SelectItem>
                              <SelectItem value="DEBIT_CARD">
                                Tarjeta Débito
                              </SelectItem>
                              <SelectItem value="CREDIT_CARD">
                                Tarjeta Crédito
                              </SelectItem>
                              <SelectItem value="TRANSFER">
                                Transferencia
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          {paymentMethod === "TRANSFER" && (
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="paymentConfirmed"
                                checked={paymentConfirmed}
                                onCheckedChange={(checked) =>
                                  setPaymentConfirmed(checked as boolean)
                                }
                              />
                              <label
                                htmlFor="paymentConfirmed"
                                className="text-sm"
                              >
                                Confirmación de Transferencia.
                              </label>
                            </div>
                          )}
                          {paymentMethod === "TRANSFER" &&
                            !paymentConfirmed && (
                              <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                  Al seleccionar Transferencia sin confirmación,
                                  la cita quedará en un estado intermedio:{" "}
                                  <strong>
                                    "Esperando Confirmación de Pago"
                                  </strong>
                                  . Permanecerá en este estado hasta que se
                                  confirme manualmente la transferencia.
                                </AlertDescription>
                              </Alert>
                            )}
                        </div>
                      )}
                    {/* If the appointment is already in the transfer-pending state,
                    show a dedicated confirmation control and message. The
                    Select is disabled until the transfer is confirmed. */}
                    {isTransferPending && (
                      <div className="space-y-2">
                        <div className="space-y-2">
                          <Label htmlFor="paymentMethodPending">
                            Método de Pago
                          </Label>
                          <Select
                            value={paymentMethod || ""}
                            onValueChange={(v) => {
                              const val = v as PaymentMethod;
                              setPaymentMethod(val);
                              // If user switches to a non-transfer method while in TRANSFER_PENDING,
                              // consider the payment confirmed and allow finishing as PAID.
                              if (val !== "TRANSFER") {
                                setPaymentConfirmed(true);
                                setSelectedNewStatus(AppointmentStatus.PAID);
                              } else {
                                // switching back to TRANSFER requires manual confirmation
                                setPaymentConfirmed(false);
                                setSelectedNewStatus(null);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona método de pago" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CASH">Efectivo</SelectItem>
                              <SelectItem value="DEBIT_CARD">
                                Tarjeta Débito
                              </SelectItem>
                              <SelectItem value="CREDIT_CARD">
                                Tarjeta Crédito
                              </SelectItem>
                              <SelectItem value="TRANSFER">
                                Transferencia
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Esta cita está en{" "}
                            <strong>Esperando Confirmación de Pago</strong>. No
                            se puede cambiar su estado hasta que se confirme la
                            transferencia.
                          </AlertDescription>
                        </Alert>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="transferConfirmCheck"
                            checked={paymentConfirmed}
                            onCheckedChange={(checked) =>
                              setPaymentConfirmed(checked as boolean)
                            }
                          />
                          <label
                            htmlFor="transferConfirmCheck"
                            className="text-sm"
                          >
                            Confirmación de Transferencia.
                          </label>
                        </div>
                      </div>
                    )}

                    {selectedNewStatus === AppointmentStatus.PAID && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="customPriceEnabled"
                            checked={paymentCustomEnabled}
                            onCheckedChange={(v) =>
                              setPaymentCustomEnabled(v as boolean)
                            }
                          />
                          <label
                            htmlFor="customPriceEnabled"
                            className="text-sm"
                          >
                            Precio Personalizado
                          </label>
                        </div>

                        {paymentCustomEnabled && (
                          <div className="space-y-2">
                            <Label htmlFor="paymentAmount">Importe</Label>
                            <div className="flex items-center space-x-2">
                              <span className="px-3 py-2 bg-muted rounded-l-md text-sm text-muted-foreground">
                                $
                              </span>
                              <Input
                                id="paymentAmount"
                                value={paymentAmount}
                                onChange={(e) =>
                                  setPaymentAmount(e.target.value)
                                }
                                placeholder="Ej: 50.00"
                                aria-invalid={
                                  paymentCustomEnabled && !isPaymentAmountValid
                                }
                                className="rounded-none rounded-r-md"
                              />
                            </div>

                            {paymentCustomEnabled && !isPaymentAmountValid && (
                              <p className="text-xs text-red-600">
                                Ingresa un número válido con hasta 2 decimales.
                              </p>
                            )}

                            {liveParsedAmount && (
                              <p className="text-xs text-green-600">
                                Se guardará:{" "}
                                <strong>${liveParsedAmount}</strong>.
                              </p>
                            )}

                            <p className="text-xs text-muted-foreground">
                              Si habilitas esto, el valor se guardará como
                              precio personalizado al confirmar.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Option: create a follow-up appointment when marking as COMPLETED */}
                    {selectedNewStatus === AppointmentStatus.COMPLETED && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="createFollowUp"
                              checked={createFollowUp}
                              onCheckedChange={(v) =>
                                setCreateFollowUp(v as boolean)
                              }
                            />
                            <label htmlFor="createFollowUp" className="text-sm">
                              Crear una nueva cita similar después de completar
                            </label>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Opcional
                          </p>
                        </div>

                        {createFollowUp && (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label>Doctor</Label>
                              <Select
                                value={followUpDoctor || ""}
                                onValueChange={(value) => {
                                  setFollowUpDoctor(value);
                                  setFollowUpDate(undefined);
                                  setFollowUpSlot(null);
                                }}
                                disabled={
                                  session?.user &&
                                  session.user.role === "DOCTOR"
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona un doctor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {doctors.map((doctor) => (
                                    <SelectItem
                                      key={doctor.id}
                                      value={doctor.id}
                                    >
                                      Dr. {doctor.user.firstName}{" "}
                                      {doctor.user.lastName}{" "}
                                      {doctor.user.secondLastName || ""}{" "}
                                      {doctor.user.specialty &&
                                        `- ${doctor.user.specialty}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {followUpDoctor && (
                              // Use a single-column layout for follow-up date/time so
                              // they don't get cramped inside the right-hand column of
                              // the two-column dialog. Ensure children take full width.
                              <div className="grid grid-cols-1 gap-4">
                                <div className="w-full">
                                  <Label>Fecha</Label>
                                  <CalendarComponent
                                    mode="single"
                                    selected={followUpDate}
                                    onSelect={(date) => {
                                      setFollowUpDate(date);
                                      setFollowUpSlot(null);
                                    }}
                                    disabled={(date) => {
                                      const today = new Date(
                                        new Date().setHours(0, 0, 0, 0)
                                      );
                                      const timezone =
                                        appointment.clinic?.timezone ||
                                        "America/Mexico_City";
                                      const key = formatDateToString(
                                        date as Date,
                                        timezone
                                      );
                                      const weekday = (date as Date).getDay();
                                      return (
                                        date < today ||
                                        unavailableDates.has(key) ||
                                        nonWorkingWeekdays.has(weekday)
                                      );
                                    }}
                                    className="rounded-md border w-full"
                                  />
                                </div>

                                {followUpDate && (
                                  <div className="w-full">
                                    <Label>Horario</Label>
                                    <SlotPicker
                                      doctorId={followUpDoctor}
                                      clinicId={appointment.clinicId}
                                      date={formatDateForInput(
                                        followUpDate,
                                        appointment.clinic?.timezone ||
                                          "America/Mexico_City"
                                      )}
                                      appointmentDurationMin={
                                        appointment.appointmentType
                                          ?.durationMin || 30
                                      }
                                      selectedSlot={followUpSlot}
                                      onSlotSelect={setFollowUpSlot}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notas Adicionales</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={
                          isNurse ? undefined : (e) => setNotes(e.target.value)
                        }
                        placeholder="Agrega notas sobre esta cita..."
                        rows={3}
                        disabled={isNurse}
                        readOnly={isNurse}
                      />
                      {isNurse && (
                        <p className="text-xs text-muted-foreground">
                          Estás en modo solo lectura — no puedes editar notas.
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleAttemptSubmit}
                      disabled={
                        // Basic disables
                        isUpdating ||
                        !selectedNewStatus ||
                        // If PAID and custom price enabled, require valid amount
                        (selectedNewStatus === AppointmentStatus.PAID &&
                          paymentCustomEnabled &&
                          !isPaymentAmountValid) ||
                        // If creating follow-up, require followUp doctor/date/slot
                        (selectedNewStatus === AppointmentStatus.COMPLETED &&
                          createFollowUp &&
                          (!followUpDoctor || !followUpDate || !followUpSlot))
                      }
                      className="w-full"
                    >
                      {isUpdating ? "Actualizando..." : "Actualizar Estado"}
                    </Button>

                    {/* Confirmation summary when creating follow-up */}
                    {showConfirm && (
                      <Card>
                        <CardHeader>
                          <CardTitle>
                            Confirmar creación de nueva cita
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p>
                            Vas a marcar la cita como{" "}
                            <strong>
                              {getStatusLabel(
                                selectedNewStatus as AppointmentStatus
                              )}
                            </strong>{" "}
                            y crear una nueva cita para el paciente{" "}
                            <strong>{patientEssentials.fullName}</strong> con
                            los siguientes datos:
                          </p>
                          <div className="space-y-1">
                            <p className="text-sm">
                              Doctor:{" "}
                              <strong>
                                {(() => {
                                  const d = doctors.find(
                                    (x) => x.id === followUpDoctor
                                  );
                                  return d
                                    ? `Dr. ${d.user.firstName} ${d.user.lastName}`
                                    : followUpDoctor;
                                })()}
                              </strong>
                            </p>
                            <p className="text-sm">
                              Fecha:{" "}
                              <strong>
                                {followUpDate
                                  ? formatDateForDisplay(
                                      formatDateForInput(
                                        followUpDate,
                                        appointment.clinic?.timezone ||
                                          "America/Mexico_City"
                                      ),
                                      appointment.clinic?.timezone ||
                                        "America/Mexico_City"
                                    )
                                  : ""}
                              </strong>
                            </p>
                            <p className="text-sm">
                              Horario:{" "}
                              <strong>
                                {followUpSlot
                                  ? `${formatTimeForDisplay(followUpSlot.startTime)} - ${formatTimeForDisplay(followUpSlot.endTime)}`
                                  : ""}
                              </strong>
                            </p>
                            {appointment.appointmentType && (
                              <p className="text-sm">
                                Motivo:{" "}
                                <strong>
                                  {appointment.appointmentType.name}
                                </strong>
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              onClick={() => setShowConfirm(false)}
                              className="flex-1"
                            >
                              Volver
                            </Button>
                            <Button
                              onClick={async () => {
                                setShowConfirm(false);
                                await handleStatusChange();
                              }}
                              className="flex-1"
                              disabled={isUpdating}
                            >
                              {isUpdating
                                ? "Procesando..."
                                : "Confirmar y Crear"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {isTerminal && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Esta cita está finalizada y no puede ser modificada.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
