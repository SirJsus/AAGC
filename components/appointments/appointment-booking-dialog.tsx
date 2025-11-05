"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { SlotPicker } from "./slot-picker";
import {
  Plus,
  Search,
  User,
  Calendar as CalendarIcon,
  Clock,
  Stethoscope,
  UserPlus,
  AlertCircle,
  FileText,
  DollarSign,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Patient,
  Doctor,
  AppointmentType,
  Room,
  Clinic,
  Gender,
} from "@prisma/client";
import { createAppointment } from "@/lib/actions/appointments";
import { getDoctorExceptions } from "@/lib/actions/doctor-schedules";
import { createPatient, searchPatients } from "@/lib/actions/patients";
import { getDoctors } from "@/lib/actions/doctors";
import { getAppointmentTypes } from "@/lib/actions/appointment-types";
import { getRooms } from "@/lib/actions/rooms";
import { getClinics } from "@/lib/actions/clinics";
import { formatDateForInput } from "@/lib/utils/timezone";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AppointmentTypeForClient extends Omit<AppointmentType, "price"> {
  price: number;
  clinic?: Clinic | null;
}

interface DoctorWithRelations extends Doctor {
  user: {
    firstName: string;
    lastName: string;
    secondLastName: string | null;
    noSecondLastName: boolean;
    specialty: string;
    licenseNumber: string | null;
  };
  clinic?: Clinic | null;
  // En la API/acciones se expone como `defaultRoom` (ver `lib/actions/doctors.ts`)
  defaultRoom?: Room | null;
  room?: Room | null;
  schedules?: Array<{
    id: string;
    weekday: number;
    startTime: string;
    endTime: string;
  }>;
}

interface AppointmentBookingDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function AppointmentBookingDialog({
  trigger,
  onSuccess,
}: AppointmentBookingDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<
    "doctor" | "patient" | "type" | "datetime" | "details"
  >("doctor");

  // Patient selection/creation
  const [patientMode, setPatientMode] = useState<"existing" | "new">(
    "existing"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // New patient data
  const [newPatientData, setNewPatientData] = useState({
    firstName: "",
    lastName: "",
    secondLastName: "",
    noSecondLastName: false,
    phone: "",
    email: "",
    gender: "OTHER" as Gender,
    birthDate: "",
  });

  // Doctor & schedule data
  const [doctors, setDoctors] = useState<DoctorWithRelations[]>([]);
  const [selectedDoctor, setSelectedDoctor] =
    useState<DoctorWithRelations | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);

  // Appointment details
  const [appointmentTypes, setAppointmentTypes] = useState<
    AppointmentTypeForClient[]
  >([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedAppointmentType, setSelectedAppointmentType] =
    useState<string>("custom");
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [customReason, setCustomReason] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customDuration, setCustomDuration] = useState("30");
  const [notes, setNotes] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    if (open) {
      loadDoctors();
      loadAppointmentTypes();
      loadRooms();
      loadClinics();
      // load availability map for next 30 days
      if (selectedDoctor) {
        loadAvailabilityForRange(selectedDoctor.id);
      }
    }
  }, [open]);

  // Availability state: dates with no available slots
  const [unavailableDates, setUnavailableDates] = useState<Set<string>>(
    new Set()
  );
  // Weekdays (0-6) that the selected doctor does NOT work
  const [nonWorkingWeekdays, setNonWorkingWeekdays] = useState<Set<number>>(
    new Set()
  );

  useEffect(() => {
    if (open && selectedDoctor) {
      // Asegurar que el consultorio del doctor se refleja en el estado
      // cuando `selectedDoctor` cambia (por ejemplo, al cargar datos previos).
      if (selectedDoctor.defaultRoom && selectedDoctor.defaultRoom.id) {
        setSelectedRoom(selectedDoctor.defaultRoom.id);
      } else if (selectedDoctor.room && selectedDoctor.room.id) {
        // Fallback por compatibilidad si algún objeto viene con `room`
        setSelectedRoom(selectedDoctor.room.id);
      } else {
        setSelectedRoom("");
      }
      loadAvailabilityForRange(selectedDoctor.id);
    }
  }, [selectedDoctor, open]);

  async function loadAvailabilityForRange(doctorId: string) {
    try {
      // Build non-working weekdays from selectedDoctor.schedules
      const workingWeekdays = new Set<number>();
      if (selectedDoctor && Array.isArray(selectedDoctor.schedules)) {
        selectedDoctor.schedules.forEach((s: any) => {
          if (typeof s.weekday === "number") workingWeekdays.add(s.weekday);
        });
      }

      const nonWorking = new Set<number>();
      for (let i = 0; i < 7; i++) {
        if (!workingWeekdays.has(i)) nonWorking.add(i);
      }
      setNonWorkingWeekdays(nonWorking);

      // Fetch explicit exceptions (from today onwards) and mark only full-day exceptions as unavailable
      const today = new Date();
      const format = (d: Date) => formatDateForInput(d);
      const exceptions = await getDoctorExceptions(doctorId, format(today));
      const unavailable = new Set<string>();
      if (Array.isArray(exceptions)) {
        exceptions.forEach((ex: any) => {
          // Only mark the whole day as unavailable when exception has no start/end
          if (ex.date && !ex.startTime && !ex.endTime) unavailable.add(ex.date);
        });
      }
      setUnavailableDates(unavailable);
    } catch (err) {
      console.error("Error loading availability range:", err);
    }
  }

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

  const loadDoctors = async () => {
    try {
      const data = await getDoctors();
      // Ensure specialty is always a string
      const normalizedData = data.map((doctor: any) => ({
        ...doctor,
        user: {
          ...doctor.user,
          specialty: doctor.user.specialty ?? "",
        },
      }));
      setDoctors(normalizedData);
    } catch (error) {
      toast.error("Error loading doctors");
    }
  };

  const loadAppointmentTypes = async () => {
    try {
      const data = await getAppointmentTypes();
      setAppointmentTypes(data);
    } catch (error) {
      toast.error("Error loading appointment types");
    }
  };

  const loadRooms = async () => {
    try {
      const data = await getRooms();
      setRooms(data);
    } catch (error) {
      toast.error("Error loading rooms");
    }
  };

  const loadClinics = async () => {
    try {
      const data = await getClinics();
      setClinics(data);
    } catch (error) {
      toast.error("Error loading clinics");
    }
  };

  const performSearch = async () => {
    setIsSearching(true);
    try {
      const results = await searchPatients(searchQuery);
      setSearchResults(results);
    } catch (error) {
      toast.error("Error searching patients");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    // Nuevo flujo: después de paciente ir al paso de selección de tipo
    setStep("type");
  };

  const handleCreateTemporaryPatient = async () => {
    if (
      !newPatientData.firstName ||
      !newPatientData.lastName ||
      !newPatientData.phone
    ) {
      toast.error(
        "Por favor completa los campos requeridos (Nombre, Apellido Paterno, Teléfono)"
      );
      return;
    }

    if (
      !newPatientData.noSecondLastName &&
      !newPatientData.secondLastName.trim()
    ) {
      toast.error(
        "Por favor completa el Apellido Materno o marca la casilla si no tiene"
      );
      return;
    }

    setIsLoading(true);
    try {
      const patient = await createPatient({
        firstName: newPatientData.firstName,
        lastName: newPatientData.lastName,
        secondLastName: newPatientData.secondLastName || undefined,
        noSecondLastName: newPatientData.noSecondLastName,
        phone: newPatientData.phone,
        email: newPatientData.email || undefined,
        birthDate: newPatientData.birthDate || undefined,
        gender: newPatientData.gender,
        doctorId: selectedDoctor?.id, // Include the selected doctor ID
      });
      setSelectedPatient(patient);
      toast.success("Paciente temporal creado");
      // Nuevo flujo: después de crear paciente temporal ir al paso de selección de tipo
      setStep("type");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al crear paciente"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDoctorSelect = (doctor: DoctorWithRelations) => {
    setSelectedDoctor(doctor);
    // Autoseleccionar el consultorio relacionado al doctor si existe,
    // pero permitir que el usuario lo cambie manualmente.
    if (doctor.defaultRoom && doctor.defaultRoom.id) {
      setSelectedRoom(doctor.defaultRoom.id);
    } else if (doctor.room && doctor.room.id) {
      // Fallback por compatibilidad
      setSelectedRoom(doctor.room.id);
    } else {
      setSelectedRoom("");
    }
    setStep("patient");
  };

  const handleTypeSelect = (typeId: string) => {
    // Reutilizar la lógica existente para aplicar valores del tipo
    handleAppointmentTypeChange(typeId);
    // Avanzar al paso de fecha/hora
    setStep("datetime");
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null); // Reset slot when date changes
  };

  const handleSlotSelect = (slot: { startTime: string; endTime: string }) => {
    setSelectedSlot(slot);
    setStep("details");
  };

  const handleBookAppointment = async () => {
    if (!selectedPatient || !selectedDoctor || !selectedDate || !selectedSlot) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    setIsLoading(true);
    try {
      await createAppointment({
        patientId: selectedPatient.id,
        doctorId: selectedDoctor.id,
        date: formatDateForInput(selectedDate),
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        appointmentTypeId:
          selectedAppointmentType !== "custom"
            ? selectedAppointmentType
            : undefined,
        roomId:
          selectedRoom && selectedRoom !== "none" ? selectedRoom : undefined,
        customReason: customReason || undefined,
        customPrice: customPrice ? parseFloat(customPrice) : undefined,
        notes: notes || undefined,
      });

      toast.success("Cita creada exitosamente");
      handleClose();
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al crear la cita"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset all state
    setTimeout(() => {
      setStep("doctor");
      setPatientMode("existing");
      setSearchQuery("");
      setSearchResults([]);
      setSelectedPatient(null);
      setNewPatientData({
        firstName: "",
        lastName: "",
        secondLastName: "",
        noSecondLastName: false,
        phone: "",
        email: "",
        gender: "OTHER",
        birthDate: "",
      });
      setSelectedDoctor(null);
      setSelectedDate(undefined);
      setSelectedSlot(null);
      setSelectedAppointmentType("custom");
      setSelectedRoom("");
      setCustomReason("");
      setCustomPrice("");
      setCustomDuration("30");
      setNotes("");
    }, 200);
  };

  const getSelectedAppointmentTypeDuration = () => {
    if (selectedAppointmentType === "custom") {
      return parseInt(customDuration) || 30;
    }
    const type = appointmentTypes.find((t) => t.id === selectedAppointmentType);
    return type?.durationMin || 30;
  };

  const handleAppointmentTypeChange = (typeId: string) => {
    setSelectedAppointmentType(typeId);

    if (typeId === "custom") {
      // Reset to custom values
      setCustomReason("");
      setCustomPrice("");
      setCustomDuration("30");
    } else {
      // Fill with type data
      const type = appointmentTypes.find((t) => t.id === typeId);
      if (type) {
        setCustomReason(type.name);
        setCustomPrice(type.price.toString());
        setCustomDuration(type.durationMin.toString());
      }
    }

    // Reset slot when duration changes
    setSelectedSlot(null);
  };

  const getDayOfWeekInSpanish = (weekday: number) => {
    const days = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    return days[weekday];
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Cita
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nueva Cita</DialogTitle>
          <DialogDescription>
            Complete el proceso para agendar una nueva cita médica
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-6">
          <div
            className={`flex items-center gap-2 ${
              step === "doctor"
                ? "text-primary font-medium"
                : "text-muted-foreground"
            }`}
          >
            <div
              className={`rounded-full h-8 w-8 flex items-center justify-center ${
                step === "doctor" ? "bg-primary text-white" : "bg-muted"
              }`}
            >
              1
            </div>
            <span className="text-sm">Doctor</span>
          </div>
          <div className="flex-1 h-px bg-border mx-2" />
          <div
            className={`flex items-center gap-2 ${
              step === "patient"
                ? "text-primary font-medium"
                : "text-muted-foreground"
            }`}
          >
            <div
              className={`rounded-full h-8 w-8 flex items-center justify-center ${
                step === "patient" ? "bg-primary text-white" : "bg-muted"
              }`}
            >
              2
            </div>
            <span className="text-sm">Paciente</span>
          </div>
          <div className="flex-1 h-px bg-border mx-2" />
          <div
            className={`flex items-center gap-2 ${
              step === "type"
                ? "text-primary font-medium"
                : "text-muted-foreground"
            }`}
          >
            <div
              className={`rounded-full h-8 w-8 flex items-center justify-center ${
                step === "type" ? "bg-primary text-white" : "bg-muted"
              }`}
            >
              3
            </div>
            <span className="text-sm">Tipo de Cita</span>
          </div>
          <div className="flex-1 h-px bg-border mx-2" />
          <div
            className={`flex items-center gap-2 ${
              step === "datetime"
                ? "text-primary font-medium"
                : "text-muted-foreground"
            }`}
          >
            <div
              className={`rounded-full h-8 w-8 flex items-center justify-center ${
                step === "datetime" ? "bg-primary text-white" : "bg-muted"
              }`}
            >
              4
            </div>
            <span className="text-sm">Fecha/Hora</span>
          </div>
          <div className="flex-1 h-px bg-border mx-2" />
          <div
            className={`flex items-center gap-2 ${
              step === "details"
                ? "text-primary font-medium"
                : "text-muted-foreground"
            }`}
          >
            <div
              className={`rounded-full h-8 w-8 flex items-center justify-center ${
                step === "details" ? "bg-primary text-white" : "bg-muted"
              }`}
            >
              5
            </div>
            <span className="text-sm">Detalles</span>
          </div>
        </div>

        {/* Step 1: Doctor Selection */}
        {step === "doctor" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Selecciona el doctor para la cita
            </div>
            <div className="grid gap-3">
              {doctors.map((doctor) => (
                <Card
                  key={doctor.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleDoctorSelect(doctor)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <Stethoscope className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">
                          {doctor.user.firstName} {doctor.user.lastName}{" "}
                          {doctor.user.secondLastName || ""}
                        </h4>
                        {doctor.user.specialty && (
                          <p className="text-sm text-muted-foreground">
                            {doctor.user.specialty}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {doctor.user.licenseNumber}
                          </Badge>
                          {doctor.clinic && (
                            <span className="text-xs text-muted-foreground">
                              {doctor.clinic.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Patient Selection/Creation */}
        {step === "patient" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Seleccionar Paciente</h3>
                <p className="text-sm text-muted-foreground">
                  Busca o crea un paciente para la cita
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("doctor")}
              >
                Cambiar Medico
              </Button>
            </div>
            <Tabs
              value={patientMode}
              onValueChange={(v) => setPatientMode(v as "existing" | "new")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">
                  <Search className="mr-2 h-4 w-4" />
                  Paciente Existente
                </TabsTrigger>
                <TabsTrigger value="new">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Paciente Nuevo
                </TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="space-y-4">
                <div className="space-y-2">
                  <Label>Buscar Paciente</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre, apellido, teléfono o expediente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {isSearching && (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                )}

                {searchResults.length > 0 && !isSearching && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {searchResults.map((patient) => (
                      <Card
                        key={patient.id}
                        className="cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => handlePatientSelect(patient)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">
                                  {patient.firstName} {patient.lastName}{" "}
                                  {patient.secondLastName}
                                </p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>{patient.customId}</span>
                                  {patient.phone && (
                                    <span>• {patient.phone}</span>
                                  )}
                                  {patient.email && (
                                    <span>• {patient.email}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {patient.pendingCompletion && (
                              <Badge variant="secondary">
                                <AlertCircle className="mr-1 h-3 w-3" />
                                Pendiente
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 &&
                  searchResults.length === 0 &&
                  !isSearching && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No se encontraron pacientes. Intenta con otro término de
                        búsqueda o crea un nuevo paciente.
                      </AlertDescription>
                    </Alert>
                  )}

                {searchQuery.length < 2 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Ingresa al menos 2 caracteres para buscar pacientes
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="new" className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Se creará un paciente temporal. Podrá completar su
                    información posteriormente.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">
                      Nombre <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      value={newPatientData.firstName}
                      onChange={(e) =>
                        setNewPatientData({
                          ...newPatientData,
                          firstName: e.target.value,
                        })
                      }
                      placeholder="Nombre"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">
                      Apellido Paterno <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      value={newPatientData.lastName}
                      onChange={(e) =>
                        setNewPatientData({
                          ...newPatientData,
                          lastName: e.target.value,
                        })
                      }
                      placeholder="Apellido Paterno"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondLastName">
                      Apellido Materno{" "}
                      {!newPatientData.noSecondLastName && (
                        <span className="text-red-500">*</span>
                      )}
                    </Label>
                    <Input
                      id="secondLastName"
                      value={newPatientData.secondLastName}
                      onChange={(e) =>
                        setNewPatientData({
                          ...newPatientData,
                          secondLastName: e.target.value,
                        })
                      }
                      placeholder="Apellido Materno"
                      disabled={newPatientData.noSecondLastName}
                    />
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="noSecondLastName"
                        checked={newPatientData.noSecondLastName}
                        onCheckedChange={(checked) => {
                          setNewPatientData({
                            ...newPatientData,
                            noSecondLastName: checked as boolean,
                            secondLastName: checked
                              ? ""
                              : newPatientData.secondLastName,
                          });
                        }}
                      />
                      <label
                        htmlFor="noSecondLastName"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        No tiene apellido materno
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      Teléfono <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="phone"
                      value={newPatientData.phone}
                      onChange={(e) =>
                        setNewPatientData({
                          ...newPatientData,
                          phone: e.target.value,
                        })
                      }
                      placeholder="Teléfono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newPatientData.email}
                      onChange={(e) =>
                        setNewPatientData({
                          ...newPatientData,
                          email: e.target.value,
                        })
                      }
                      placeholder="correo@ejemplo.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Género</Label>
                    <Select
                      value={newPatientData.gender}
                      onValueChange={(value) =>
                        setNewPatientData({
                          ...newPatientData,
                          gender: value as Gender,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Masculino</SelectItem>
                        <SelectItem value="FEMALE">Femenino</SelectItem>
                        <SelectItem value="OTHER">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={newPatientData.birthDate}
                      onChange={(e) =>
                        setNewPatientData({
                          ...newPatientData,
                          birthDate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <Button
                  onClick={handleCreateTemporaryPatient}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading
                    ? "Creando..."
                    : "Crear Paciente Temporal y Continuar"}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Step 3: Tipo de Cita */}
        {step === "type" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Seleccionar Tipo de Cita</h3>
                <p className="text-sm text-muted-foreground">
                  Elige un tipo de cita o selecciona "Personalizado"
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("patient")}
              >
                Cambiar Paciente
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card
                className={`cursor-pointer hover:bg-accent transition-colors ${
                  selectedAppointmentType === "custom"
                    ? "ring-2 ring-primary"
                    : ""
                }`}
                onClick={() => handleTypeSelect("custom")}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-full">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Personalizado</h4>
                      <p className="text-sm text-muted-foreground">
                        Configura duración, motivo y precio manualmente
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {appointmentTypes.map((type) => (
                <Card
                  key={type.id}
                  className={`cursor-pointer hover:bg-accent transition-colors ${
                    selectedAppointmentType === type.id
                      ? "ring-2 ring-primary"
                      : ""
                  }`}
                  onClick={() => handleTypeSelect(type.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <Stethoscope className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{type.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Duración: {type.durationMin} min • Precio: $
                          {Number(type.price).toFixed(2)}
                        </p>
                        {type.preInstructions && (
                          <p className="text-sm mt-2">{type.preInstructions}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Date & Time Selection */}
        {step === "datetime" && selectedDoctor && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Seleccionar Fecha y Hora</h3>
                <p className="text-sm text-muted-foreground">
                  Doctor: Dr. {selectedDoctor.user.firstName}{" "}
                  {selectedDoctor.user.lastName}{" "}
                  {selectedDoctor.user.secondLastName || ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("doctor")}
              >
                Cambiar Doctor
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("type")}
                className="ml-2"
              >
                Cambiar Tipo de Cita
              </Button>
            </div>

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
                      const key = formatDateForInput(date as Date);
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

              <div>
                {selectedDate && (
                  <SlotPicker
                    doctorId={selectedDoctor.id}
                    clinicId={selectedDoctor.clinicId}
                    date={formatDateForInput(selectedDate)}
                    appointmentDurationMin={getSelectedAppointmentTypeDuration()}
                    selectedSlot={selectedSlot}
                    onSlotSelect={handleSlotSelect}
                  />
                )}
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
              </div>
            </div>

            {/* (El selector de tipo fue movido a su propio paso) */}
          </div>
        )}

        {/* Step 4: Appointment Details */}
        {step === "details" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Detalles de la Cita</h3>
                <p className="text-sm text-muted-foreground">
                  Revisa y completa la información de la cita
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("datetime")}
              >
                Cambiar Fecha/Hora
              </Button>
            </div>

            {/* Summary */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Paciente</p>
                    <p className="font-medium">
                      {selectedPatient?.firstName} {selectedPatient?.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Doctor</p>
                    <p className="font-medium">
                      Dr. {selectedDoctor?.user.firstName}{" "}
                      {selectedDoctor?.user.lastName}{" "}
                      {selectedDoctor?.user.secondLastName || ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="font-medium">
                      {selectedDate?.toLocaleDateString("es-MX", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Horario</p>
                    <p className="font-medium">
                      {selectedSlot?.startTime} - {selectedSlot?.endTime}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Type information */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Tipo de Cita</p>
                  {selectedAppointmentType === "custom" ? (
                    <Badge variant="outline">Personalizado</Badge>
                  ) : (
                    <div>
                      <p className="font-medium">
                        {appointmentTypes.find(
                          (t) => t.id === selectedAppointmentType
                        )?.name || "No especificado"}
                      </p>
                      {(() => {
                        const type = appointmentTypes.find(
                          (t) => t.id === selectedAppointmentType
                        );
                        if (!type) return null;
                        return (
                          <div className="mt-1 space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Duración: {type.durationMin} min | Precio: $
                              {Number(type.price).toFixed(2)}
                            </p>
                            {type.preInstructions && (
                              <p className="text-sm text-muted-foreground">
                                {type.preInstructions}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Optional fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="room">Consultorio (Opcional)</Label>
                <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un consultorio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Sin consultorio asignado
                    </SelectItem>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom fields only for "custom" type */}
              {selectedAppointmentType === "custom" && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4" />
                        Motivo de Consulta
                      </CardTitle>
                      <CardDescription>
                        Especifica el motivo de la consulta médica
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Input
                          id="customReason"
                          value={customReason}
                          onChange={(e) => setCustomReason(e.target.value)}
                          placeholder="Ej: Consulta general, seguimiento, revisión..."
                        />
                        <p className="text-xs text-muted-foreground">
                          Personaliza el motivo de la cita
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <DollarSign className="h-4 w-4" />
                        Costo de la Consulta
                      </CardTitle>
                      <CardDescription>
                        Define el costo para esta consulta (opcional)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Input
                          id="customPrice"
                          type="number"
                          step="0.01"
                          value={customPrice}
                          onChange={(e) => setCustomPrice(e.target.value)}
                          placeholder="0.00"
                        />
                        <p className="text-xs text-muted-foreground">
                          Ingresa el costo personalizado para esta consulta
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notas (Opcional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas adicionales sobre la cita..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleBookAppointment}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? "Creando Cita..." : "Confirmar y Crear Cita"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
