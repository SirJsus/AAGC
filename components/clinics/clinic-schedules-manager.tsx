"use client";

import { useState, useEffect } from "react";
import { Clinic } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Clock, Plus, Trash2, Calendar } from "lucide-react";
import {
  createClinicSchedule,
  getClinicSchedules,
  deleteClinicSchedule,
} from "@/lib/actions/clinic-schedules";

const WEEKDAYS = [
  { value: 0, label: "Domingo", short: "D" },
  { value: 1, label: "Lunes", short: "L" },
  { value: 2, label: "Martes", short: "M" },
  { value: 3, label: "Miércoles", short: "X" },
  { value: 4, label: "Jueves", short: "J" },
  { value: 5, label: "Viernes", short: "V" },
  { value: 6, label: "Sábado", short: "S" },
];

interface Schedule {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

interface ClinicSchedulesManagerProps {
  clinic: Clinic;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ClinicSchedulesManager({
  clinic,
  trigger,
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ClinicSchedulesManagerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (value: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
  };

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

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

  useEffect(() => {
    if (open) {
      loadSchedules();
    }
  }, [open]);

  async function loadSchedules() {
    if (!clinic?.id) return;

    setLoading(true);
    try {
      const data = await getClinicSchedules(clinic.id);
      setSchedules(data);
    } catch (error) {
      console.error("Error loading schedules:", error);
      toast.error("Error al cargar los horarios");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSchedule() {
    if (!clinic?.id) return;

    if (scheduleForm.selectedDays.length === 0) {
      toast.error("Seleccione al menos un día");
      return;
    }

    try {
      // Create schedule for each selected day
      const promises = scheduleForm.selectedDays.map((weekday) =>
        createClinicSchedule({
          clinicId: clinic.id,
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
      loadSchedules();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Error al crear el horario");
    }
  }

  async function handleDeleteSchedule(id: string) {
    if (!confirm("¿Está seguro de eliminar este horario?")) return;

    try {
      await deleteClinicSchedule(id);
      toast.success("Horario eliminado exitosamente");
      loadSchedules();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar el horario");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm">
              <Clock className="mr-2 h-4 w-4" />
              Horarios
            </Button>
          )}
        </DialogTrigger>

        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Horarios de Atención - {clinic.name}
            </DialogTitle>
            <DialogDescription>
              Configura los días y horarios de atención de la clínica. Estos
              horarios sirven como plantilla base para los médicos que no tengan
              horarios específicos definidos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Horario regular de atención de la clínica
              </p>
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
                  No hay horarios configurados. Agrega el primer horario para
                  comenzar.
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
                      <CardContent className="pt-6">
                        <div className="font-semibold mb-3 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {day.label}
                        </div>
                        <div className="space-y-2">
                          {daySchedules.map((schedule) => (
                            <div
                              key={schedule.id}
                              className="flex items-center justify-between p-3 bg-muted rounded-lg"
                            >
                              <span className="font-mono">
                                {schedule.startTime} - {schedule.endTime}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleDeleteSchedule(schedule.id)
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
