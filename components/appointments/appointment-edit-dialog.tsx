"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  Search,
  User,
  AlertCircle,
} from "lucide-react";
import { AppointmentWithRelations } from "@/types/appointments";
import { updateAppointment } from "@/lib/actions/appointments";
import { getDoctors } from "@/lib/actions/doctors";
import { getAppointmentTypes } from "@/lib/actions/appointment-types";
import { getRooms } from "@/lib/actions/rooms";
import { searchPatients } from "@/lib/actions/patients";
import { getDoctorExceptions } from "@/lib/actions/doctor-schedules";
import { Doctor, AppointmentType, Room, Patient, Clinic } from "@prisma/client";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { SlotPicker } from "./slot-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDateForInput, formatDateToString } from "@/lib/utils/timezone";

interface DoctorWithRelations extends Doctor {
  user: {
    firstName: string;
    lastName: string;
    secondLastName: string | null;
  };
  clinic?: Clinic | null;
  schedules?: Array<{
    id: string;
    weekday: number;
    startTime: string;
    endTime: string;
  }>;
}

interface AppointmentEditDialogProps {
  appointment: AppointmentWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AppointmentEditDialog({
  appointment,
  open,
  onOpenChange,
  onSuccess,
}: AppointmentEditDialogProps) {
  // Helper function to calculate duration in minutes
  function calculateDuration(start: string, end: string): number {
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    return endHour * 60 + endMin - (startHour * 60 + startMin);
  }

  const [isSaving, setIsSaving] = useState(false);
  const [doctors, setDoctors] = useState<DoctorWithRelations[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<any[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Availability state
  const [unavailableDates, setUnavailableDates] = useState<Set<string>>(
    new Set()
  );
  const [nonWorkingWeekdays, setNonWorkingWeekdays] = useState<Set<number>>(
    new Set()
  );
  const [usingClinicSchedules, setUsingClinicSchedules] = useState(false);

  // Patient search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(
    appointment.patientId
  );
  const [selectedPatientName, setSelectedPatientName] = useState(
    `${appointment.patient.firstName} ${appointment.patient.lastName} ${appointment.patient.secondLastName || ""}`
  );
  const [isChangingPatient, setIsChangingPatient] = useState(false);

  // Form state
  const [selectedDoctor, setSelectedDoctor] = useState(appointment.doctorId);
  const [selectedRoom, setSelectedRoom] = useState(
    appointment.roomId || "none"
  );
  const [selectedAppointmentType, setSelectedAppointmentType] = useState(
    appointment.appointmentTypeId || "custom"
  );
  const [customReason, setCustomReason] = useState(
    appointment.customReason || ""
  );
  const [customPrice, setCustomPrice] = useState(
    appointment.customPrice?.toString() || ""
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    appointment.date instanceof Date
      ? appointment.date
      : new Date(appointment.date)
  );
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: string;
    endTime: string;
  } | null>({
    startTime: appointment.startTime,
    endTime: appointment.endTime,
  });
  const [notes, setNotes] = useState(appointment.notes || "");
  const [customDuration, setCustomDuration] = useState(
    calculateDuration(appointment.startTime, appointment.endTime).toString()
  );

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  // Load availability when doctor changes
  useEffect(() => {
    if (open && selectedDoctor) {
      const doctor = doctors.find((d) => d.id === selectedDoctor);
      if (doctor) {
        loadAvailabilityForRange(doctor);
      }
    }
  }, [selectedDoctor, open, doctors]);

  // Search patients when query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = async () => {
    try {
      const [doctorsData, appointmentTypesData, roomsData] = await Promise.all([
        getDoctors(),
        getAppointmentTypes(),
        getRooms(),
      ]);
      setDoctors(doctorsData.doctors);
      setAppointmentTypes(appointmentTypesData.appointmentTypes);
      setRooms(roomsData);
    } catch (error) {
      toast.error("Error al cargar datos");
    }
  };

  const performSearch = async () => {
    setIsSearching(true);
    try {
      const results = await searchPatients(searchQuery);
      setSearchResults(results);
    } catch (error) {
      toast.error("Error al buscar pacientes");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setSelectedPatientName(
      `${patient.firstName} ${patient.lastName} ${patient.secondLastName || ""}`
    );
    setIsChangingPatient(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  async function loadAvailabilityForRange(doctor: DoctorWithRelations) {
    try {
      const workingWeekdays = new Set<number>();
      let hasClinicSchedules = false;

      if (doctor && Array.isArray(doctor.schedules)) {
        doctor.schedules.forEach((s: any) => {
          if (typeof s.weekday === "number") {
            workingWeekdays.add(s.weekday);
            if (
              s.id &&
              typeof s.id === "string" &&
              s.id.startsWith("clinic-")
            ) {
              hasClinicSchedules = true;
            }
          }
        });
      }

      setUsingClinicSchedules(hasClinicSchedules);

      const nonWorking = new Set<number>();
      for (let i = 0; i < 7; i++) {
        if (!workingWeekdays.has(i)) nonWorking.add(i);
      }

      setNonWorkingWeekdays(nonWorking);

      const today = new Date();
      const timezone = doctor?.clinic?.timezone || "America/Mexico_City";
      const todayString = formatDateToString(today, timezone);
      const exceptions = await getDoctorExceptions(doctor.id, todayString);
      const unavailable = new Set<string>();
      if (Array.isArray(exceptions)) {
        exceptions.forEach((ex: any) => {
          if (ex.date && !ex.startTime && !ex.endTime) unavailable.add(ex.date);
        });
      }
      setUnavailableDates(unavailable);
    } catch (err) {
      console.error("Error loading availability:", err);
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot: { startTime: string; endTime: string }) => {
    setSelectedSlot(slot);
  };

  const getSelectedAppointmentTypeDuration = (): number => {
    if (customDuration) {
      return parseInt(customDuration) || 30;
    }
    return 30;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (!selectedDate) {
        toast.error("Por favor selecciona una fecha");
        setIsSaving(false);
        return;
      }

      if (!selectedSlot) {
        toast.error("Por favor selecciona un horario");
        setIsSaving(false);
        return;
      }

      await updateAppointment(appointment.id, {
        patientId: selectedPatientId,
        doctorId: selectedDoctor,
        roomId: selectedRoom === "none" ? undefined : selectedRoom,
        appointmentTypeId:
          selectedAppointmentType === "custom"
            ? undefined
            : selectedAppointmentType,
        customReason: customReason || undefined,
        customPrice: customPrice ? parseFloat(customPrice) : undefined,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        notes: notes || undefined,
      });

      toast.success("Cita actualizada correctamente");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al actualizar la cita"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cita</DialogTitle>
          <DialogDescription>
            Modifica los detalles de la cita. Todos los cambios se guardarán
            inmediatamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Info */}
          <div className="space-y-2">
            <Label>Paciente *</Label>
            {!isChangingPatient ? (
              <div className="flex gap-2">
                <Input value={selectedPatientName} disabled />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsChangingPatient(true)}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, apellido, teléfono o expediente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {isSearching && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  </div>
                )}

                {searchResults.length > 0 && !isSearching && (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                    {searchResults.map((patient) => (
                      <div
                        key={patient.id}
                        className="p-3 hover:bg-accent rounded-md cursor-pointer transition-colors"
                        onClick={() => handlePatientSelect(patient)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {patient.firstName} {patient.lastName}{" "}
                              {patient.secondLastName}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{patient.customId}</span>
                              {patient.phone && <span>• {patient.phone}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 &&
                  searchResults.length === 0 &&
                  !isSearching && (
                    <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5" />
                      <span>
                        No se encontraron pacientes. Intenta con otro término de
                        búsqueda.
                      </span>
                    </div>
                  )}

                {searchQuery.length < 2 && (
                  <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>
                      Ingresa al menos 2 caracteres para buscar pacientes
                    </span>
                  </div>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsChangingPatient(false);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          {/* Doctor */}
          <div className="space-y-2">
            <Label htmlFor="doctor">Doctor *</Label>
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    Dr. {doctor.user.firstName} {doctor.user.lastName}{" "}
                    {doctor.user.secondLastName || ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room */}
          <div className="space-y-2">
            <Label htmlFor="room">Consultorio</Label>
            <Select value={selectedRoom} onValueChange={setSelectedRoom}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un consultorio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin consultorio</SelectItem>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Appointment Type */}
          <div className="space-y-2">
            <Label htmlFor="appointmentType">Tipo de Cita</Label>
            <Select
              value={selectedAppointmentType}
              onValueChange={setSelectedAppointmentType}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un tipo de cita" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Personalizado</SelectItem>
                {appointmentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name} - ${type.price.toString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Reason */}
          {selectedAppointmentType === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="customReason">Motivo personalizado</Label>
              <Input
                id="customReason"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Ej: Consulta general"
              />
            </div>
          )}

          {/* Custom Price */}
          <div className="space-y-2">
            <Label htmlFor="customPrice">Precio personalizado (opcional)</Label>
            <Input
              id="customPrice"
              type="number"
              step="0.01"
              min="0"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              placeholder="Ej: 500.00"
            />
          </div>

          {/* Date and Time Selection */}
          {usingClinicSchedules && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este médico está usando los horarios de atención de la clínica.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarIcon className="h-4 w-4" />
                  Seleccionar Fecha
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => {
                    const today = new Date(new Date().setHours(0, 0, 0, 0));
                    const selectedDoctorObj = doctors.find(
                      (d) => d.id === selectedDoctor
                    );
                    const timezone =
                      selectedDoctorObj?.clinic?.timezone ||
                      "America/Mexico_City";
                    const key = formatDateToString(date as Date, timezone);
                    const weekday = (date as Date).getDay();
                    return (
                      date < today ||
                      unavailableDates.has(key) ||
                      nonWorkingWeekdays.has(weekday)
                    );
                  }}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            <div className="space-y-4">
              {/* Duration field */}
              <Card className="bg-blue-50/50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4" />
                    Duración de la Cita
                  </CardTitle>
                  <CardDescription>
                    {selectedAppointmentType !== "custom"
                      ? "Duración sugerida por el tipo de cita. Puedes modificarla si es necesario."
                      : "Especifica la duración de la cita en minutos"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        id="customDuration"
                        type="number"
                        min="5"
                        step="5"
                        value={customDuration}
                        onChange={(e) => {
                          setCustomDuration(e.target.value);
                          // Reset slot when duration changes
                          setSelectedSlot(null);
                        }}
                        placeholder="30"
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">
                        minutos
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Los horarios disponibles se ajustarán según la duración.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {selectedDate &&
                selectedDoctor &&
                (() => {
                  const selectedDoctorObj = doctors.find(
                    (d) => d.id === selectedDoctor
                  );
                  if (!selectedDoctorObj) return null;

                  return (
                    <SlotPicker
                      doctorId={selectedDoctor}
                      clinicId={selectedDoctorObj.clinicId}
                      date={formatDateForInput(
                        selectedDate,
                        selectedDoctorObj.clinic?.timezone ||
                          "America/Mexico_City"
                      )}
                      appointmentDurationMin={getSelectedAppointmentTypeDuration()}
                      selectedSlot={selectedSlot}
                      onSlotSelect={handleSlotSelect}
                    />
                  );
                })()}

              {!selectedDate && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">
                      Selecciona una fecha para ver los horarios disponibles
                    </p>
                  </CardContent>
                </Card>
              )}

              {selectedSlot && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Horario seleccionado:</strong>{" "}
                    {selectedSlot.startTime} - {selectedSlot.endTime}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
