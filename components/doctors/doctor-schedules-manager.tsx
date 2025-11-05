"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getDoctors, getDoctorByUserId } from "@/lib/actions/doctors";
import { useSession } from "next-auth/react";
import {
  createDoctorSchedule,
  getDoctorSchedules,
  deleteDoctorSchedule,
  createDoctorException,
  getDoctorExceptions,
  deleteDoctorException,
} from "@/lib/actions/doctor-schedules";

const WEEKDAYS = [
  { value: 0, label: "Domingo", short: "D" },
  { value: 1, label: "Lunes", short: "L" },
  { value: 2, label: "Martes", short: "M" },
  { value: 3, label: "Miércoles", short: "X" },
  { value: 4, label: "Jueves", short: "J" },
  { value: 5, label: "Viernes", short: "V" },
  { value: 6, label: "Sábado", short: "S" },
];

interface Doctor {
  id: string;
  user: {
    firstName: string;
    lastName: string;
    secondLastName: string | null;
    noSecondLastName: boolean;
    specialty: string | null;
    licenseNumber: string | null;
  };
}

interface Schedule {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

interface Exception {
  id: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
}

export function DoctorSchedulesManager() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    selectedDays: [] as number[],
    startTime: "09:00",
    endTime: "17:00",
  });

  const toggleDay = (dayValue: number) => {
    setScheduleForm((prev) => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(dayValue)
        ? prev.selectedDays.filter((d) => d !== dayValue)
        : [...prev.selectedDays, dayValue],
    }));
  };

  // Exception form state
  const [exceptionForm, setExceptionForm] = useState({
    date: "",
    // range support
    range: false,
    rangeStart: "",
    rangeEnd: "",
    startTime: "",
    endTime: "",
    reason: "",
    fullDay: false,
  });
  const [creatingException, setCreatingException] = useState(false);

  const { data: session } = useSession() || {};

  useEffect(() => {
    // If the user is a doctor, load only their doctor record and auto-select it.
    if (session?.user && session.user.role === "DOCTOR") {
      (async () => {
        try {
          const doc = await getDoctorByUserId();
          setDoctors([doc]);
          setSelectedDoctor(doc.id);
        } catch (error) {
          console.error("Error loading doctor for user:", error);
          toast.error("Error al cargar el doctor actual");
        }
      })();
    } else {
      loadDoctors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (selectedDoctor) {
      loadSchedulesAndExceptions();
    }
  }, [selectedDoctor]);

  async function loadDoctors() {
    try {
      const data = await getDoctors();
      setDoctors(data);
    } catch (error) {
      console.error("Error loading doctors:", error);
      toast.error("Error al cargar los doctores");
    }
  }

  async function loadSchedulesAndExceptions() {
    if (!selectedDoctor) return;

    setLoading(true);
    try {
      const [schedulesData, exceptionsData] = await Promise.all([
        getDoctorSchedules(selectedDoctor),
        getDoctorExceptions(selectedDoctor),
      ]);
      setSchedules(schedulesData);
      setExceptions(exceptionsData);
    } catch (error) {
      console.error("Error loading schedules:", error);
      toast.error("Error al cargar los horarios");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSchedule() {
    if (!selectedDoctor) return;

    if (scheduleForm.selectedDays.length === 0) {
      toast.error("Seleccione al menos un día");
      return;
    }

    try {
      // Create schedule for each selected day
      const promises = scheduleForm.selectedDays.map((weekday) =>
        createDoctorSchedule({
          doctorId: selectedDoctor,
          weekday,
          startTime: scheduleForm.startTime,
          endTime: scheduleForm.endTime,
        })
      );

      await Promise.all(promises);

      toast.success(
        `Horario agregado para ${scheduleForm.selectedDays.length} día(s)`
      );
      setScheduleDialogOpen(false);
      setScheduleForm({
        selectedDays: [],
        startTime: "09:00",
        endTime: "17:00",
      });
      loadSchedulesAndExceptions();
    } catch (error: any) {
      toast.error(error.message || "Error al crear el horario");
    }
  }

  async function handleCreateException() {
    if (!selectedDoctor) return;

    setCreatingException(true);
    try {
      if (exceptionForm.range) {
        const { rangeStart, rangeEnd } = exceptionForm;
        if (!rangeStart || !rangeEnd) {
          toast.error("Debe especificar fecha inicio y fin del rango");
          return;
        }

        const startDate = new Date(rangeStart);
        const endDate = new Date(rangeEnd);
        if (startDate > endDate) {
          toast.error(
            "La fecha de inicio debe ser anterior o igual a la fecha de fin"
          );
          return;
        }

        const dates = generateDateRange(rangeStart, rangeEnd);
        const MAX_DAYS = 31;
        if (dates.length > MAX_DAYS) {
          toast.error(`El rango no puede exceder ${MAX_DAYS} días`);
          return;
        }

        const promises = dates.map((d) =>
          createDoctorException({
            doctorId: selectedDoctor,
            date: d,
            startTime: exceptionForm.fullDay
              ? undefined
              : exceptionForm.startTime || undefined,
            endTime: exceptionForm.fullDay
              ? undefined
              : exceptionForm.endTime || undefined,
            reason: exceptionForm.reason || undefined,
          })
        );

        const results = await Promise.allSettled(promises);
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length === 0) {
          toast.success("Excepciones agregadas exitosamente");
        } else {
          toast.error(
            `${failed.length} de ${dates.length} no se pudieron crear`
          );
        }
      } else {
        if (!exceptionForm.date) {
          toast.error("Seleccione una fecha para la excepción");
          return;
        }

        await createDoctorException({
          doctorId: selectedDoctor,
          date: exceptionForm.date,
          startTime: exceptionForm.fullDay
            ? undefined
            : exceptionForm.startTime || undefined,
          endTime: exceptionForm.fullDay
            ? undefined
            : exceptionForm.endTime || undefined,
          reason: exceptionForm.reason || undefined,
        });
        toast.success("Excepción agregada exitosamente");
      }

      setExceptionDialogOpen(false);
      setExceptionForm({
        date: "",
        range: false,
        rangeStart: "",
        rangeEnd: "",
        startTime: "",
        endTime: "",
        reason: "",
        fullDay: false,
      });
      loadSchedulesAndExceptions();
    } catch (error: any) {
      toast.error(error.message || "Error al crear la excepción");
    } finally {
      setCreatingException(false);
    }
  }

  async function handleDeleteException(id: string) {
    if (!confirm("¿Está seguro de eliminar esta excepción?")) return;

    try {
      await deleteDoctorException(id);
      toast.success("Excepción eliminada exitosamente");
      loadSchedulesAndExceptions();
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar la excepción");
    }
  }

  async function handleDeleteSchedule(id: string) {
    if (!confirm("¿Está seguro de eliminar este horario?")) return;

    try {
      await deleteDoctorSchedule(id);
      toast.success("Horario eliminado exitosamente");
      loadSchedulesAndExceptions();
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar el horario");
    }
  }

  return (
    <div className="space-y-6">
      {/* Doctor selector: hidden for DOCTOR role (they see only their own record) */}
      <div className="flex items-end gap-4">
        <div className="flex-1 space-y-2">
          <Label>Medic</Label>
          {session?.user && session.user.role === "DOCTOR" ? (
            <div className="p-3 rounded bg-muted">
              {doctors[0] ? (
                <span>
                  Dr. {doctors[0].user.firstName} {doctors[0].user.lastName}
                  {doctors[0].user.specialty &&
                    ` - ${doctors[0].user.specialty}`}
                </span>
              ) : (
                <span>Mi perfil (cargando...)</span>
              )}
            </div>
          ) : (
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione un doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    Dr. {doctor.user.firstName} {doctor.user.lastName}
                    {doctor.user.specialty && ` - ${doctor.user.specialty}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {selectedDoctor && (
        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schedule">
              <Clock className="mr-2 h-4 w-4" />
              Horarios Regulares
            </TabsTrigger>
            <TabsTrigger value="exceptions">
              <Calendar className="mr-2 h-4 w-4" />
              Excepciones
            </TabsTrigger>
          </TabsList>

          {/* Regular Schedules Tab */}
          <TabsContent value="schedule" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Configure los días y horarios de trabajo regulares del doctor
                </p>
                <p className="text-xs text-muted-foreground">
                  Si no se configuran horarios específicos, se usarán los
                  horarios de atención de la clínica
                </p>
              </div>
              <Button onClick={() => setScheduleDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Horario
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8">Cargando...</div>
            ) : schedules.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No hay horarios configurados</p>
                  <p className="text-sm mt-2">
                    Este doctor usará los horarios de la clínica si están
                    definidos
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {WEEKDAYS.map((day) => {
                  const daySchedules = schedules.filter(
                    (s) => s.weekday === day.value
                  );
                  if (daySchedules.length === 0) return null;

                  return (
                    <Card key={day.value}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{day.label}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {daySchedules.map((schedule) => {
                            const isInherited =
                              schedule.id.startsWith("clinic-");
                            return (
                              <div
                                key={schedule.id}
                                className="flex items-center justify-between p-3 bg-muted rounded-lg"
                              >
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {schedule.startTime} - {schedule.endTime}
                                  </span>
                                  {isInherited && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                      Heredado de la clínica
                                    </span>
                                  )}
                                </div>
                                {!isInherited && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleDeleteSchedule(schedule.id)
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Exceptions Tab */}
          <TabsContent value="exceptions" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Configure vacaciones, días libres u otras excepciones al horario
                regular
              </p>
              <Button onClick={() => setExceptionDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Excepción
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8">Cargando...</div>
            ) : exceptions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No hay excepciones configuradas</p>
                </CardContent>
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Horario</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exceptions.map((exception) => (
                    <TableRow key={exception.id}>
                      <TableCell className="font-medium">
                        {new Date(
                          exception.date + "T00:00:00"
                        ).toLocaleDateString("es-MX", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        {exception.startTime && exception.endTime ? (
                          <span>
                            {exception.startTime} - {exception.endTime}
                          </span>
                        ) : (
                          <Badge variant="secondary">Día completo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {exception.reason || "Sin motivo especificado"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteException(exception.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Add Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Horario Regular</DialogTitle>
            <DialogDescription>
              Seleccione los días y configure el horario que se aplicará a todos
              ellos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label>Días de la semana</Label>
              <div className="flex gap-2 justify-center">
                {WEEKDAYS.map((day) => {
                  const isSelected = scheduleForm.selectedDays.includes(
                    day.value
                  );
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`
                        w-12 h-12 rounded-full font-semibold text-sm
                        transition-all duration-200
                        ${
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-md scale-110"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }
                      `}
                      title={day.label}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Haz clic en los días para seleccionarlos
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Hora de inicio</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={scheduleForm.startTime}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      startTime: e.target.value,
                    })
                  }
                  className="[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:hover:bg-accent [&::-webkit-calendar-picker-indicator]:rounded-sm [&::-webkit-calendar-picker-indicator]:p-1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Hora de fin</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={scheduleForm.endTime}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      endTime: e.target.value,
                    })
                  }
                  className="[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:hover:bg-accent [&::-webkit-calendar-picker-indicator]:rounded-sm [&::-webkit-calendar-picker-indicator]:p-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setScheduleDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateSchedule}
              disabled={scheduleForm.selectedDays.length === 0}
            >
              Agregar Horario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Exception Dialog */}
      <Dialog open={exceptionDialogOpen} onOpenChange={setExceptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Excepción</DialogTitle>
            <DialogDescription>
              Configure un día o periodo en el que el doctor no estará
              disponible
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="exceptionDate">Fecha</Label>
              <div className="flex items-center space-x-4">
                {!exceptionForm.range ? (
                  <Input
                    id="exceptionDate"
                    type="date"
                    value={exceptionForm.date}
                    onChange={(e) =>
                      setExceptionForm({
                        ...exceptionForm,
                        date: e.target.value,
                      })
                    }
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <Input
                      id="rangeStart"
                      type="date"
                      value={exceptionForm.rangeStart}
                      onChange={(e) =>
                        setExceptionForm({
                          ...exceptionForm,
                          rangeStart: e.target.value,
                        })
                      }
                      placeholder="Desde"
                    />
                    <Input
                      id="rangeEnd"
                      type="date"
                      value={exceptionForm.rangeEnd}
                      onChange={(e) =>
                        setExceptionForm({
                          ...exceptionForm,
                          rangeEnd: e.target.value,
                        })
                      }
                      placeholder="Hasta"
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="range"
                    checked={exceptionForm.range}
                    onChange={(e) =>
                      setExceptionForm({
                        ...exceptionForm,
                        range: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300"
                    title="Rango de fechas"
                    aria-label="Rango de fechas"
                  />
                  <Label
                    htmlFor="range"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Rango de fechas
                  </Label>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="fullDay"
                title="Día completo"
                aria-label="Día completo"
                checked={exceptionForm.fullDay}
                onChange={(e) =>
                  setExceptionForm({
                    ...exceptionForm,
                    fullDay: e.target.checked,
                  })
                }
                className="rounded border-gray-300"
              />
              <Label
                htmlFor="fullDay"
                className="text-sm font-normal cursor-pointer"
              >
                Día completo (sin horario específico)
              </Label>
            </div>
            {!exceptionForm.fullDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exceptionStartTime">Hora de inicio</Label>
                  <Input
                    id="exceptionStartTime"
                    type="time"
                    value={exceptionForm.startTime}
                    onChange={(e) =>
                      setExceptionForm({
                        ...exceptionForm,
                        startTime: e.target.value,
                      })
                    }
                    className="[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:hover:bg-accent [&::-webkit-calendar-picker-indicator]:rounded-sm [&::-webkit-calendar-picker-indicator]:p-1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exceptionEndTime">Hora de fin</Label>
                  <Input
                    id="exceptionEndTime"
                    type="time"
                    value={exceptionForm.endTime}
                    onChange={(e) =>
                      setExceptionForm({
                        ...exceptionForm,
                        endTime: e.target.value,
                      })
                    }
                    className="[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:hover:bg-accent [&::-webkit-calendar-picker-indicator]:rounded-sm [&::-webkit-calendar-picker-indicator]:p-1"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo (opcional)</Label>
              <Textarea
                id="reason"
                placeholder="Ej: Vacaciones, Conferencia médica, etc."
                value={exceptionForm.reason}
                onChange={(e) =>
                  setExceptionForm({ ...exceptionForm, reason: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExceptionDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateException}
              disabled={creatingException}
            >
              {creatingException ? "Procesando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper: generate array of YYYY-MM-DD between two dates inclusive
function generateDateRange(start: string, end: string) {
  const dates: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}
