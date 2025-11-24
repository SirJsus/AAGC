"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Filter } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DoctorReportFilters {
  period: "day" | "week" | "month" | "year" | "custom";
  appointmentTypeId: string;
  startDate?: string;
  endDate?: string;
}

interface DoctorReportsFiltersProps {
  filters: DoctorReportFilters;
  onFiltersChange: (filters: DoctorReportFilters) => void;
  clinicId?: string | null;
}

export function DoctorReportsFilters({
  filters,
  onFiltersChange,
  clinicId,
}: DoctorReportsFiltersProps) {
  const [appointmentTypes, setAppointmentTypes] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  useEffect(() => {
    // Cargar tipos de cita según la clínica del médico
    const typesUrl = clinicId
      ? `/api/appointment-types?clinicId=${clinicId}`
      : "/api/appointment-types";

    fetch(typesUrl)
      .then((res) => res.json())
      .then((data) => {
        const typesList = data.map((t: any) => ({
          id: t.id,
          name: t.name,
        }));
        setAppointmentTypes(typesList);
      })
      .catch(console.error);
  }, [clinicId]);

  const handlePeriodChange = (value: string) => {
    const newFilters = {
      ...filters,
      period: value as DoctorReportFilters["period"],
    };
    // Limpiar fechas si no es custom
    if (value !== "custom") {
      newFilters.startDate = undefined;
      newFilters.endDate = undefined;
      setStartDate(undefined);
      setEndDate(undefined);
    }
    onFiltersChange(newFilters);
  };

  const handleApplyCustomDates = () => {
    if (startDate && endDate) {
      onFiltersChange({
        ...filters,
        period: "custom",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Período */}
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={filters.period} onValueChange={handlePeriodChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Hoy</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mes</SelectItem>
                <SelectItem value="year">Este año</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Cita */}
          <div className="space-y-2">
            <Label>Tipo de Cita</Label>
            <Select
              value={filters.appointmentTypeId}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, appointmentTypeId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {appointmentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Fechas personalizadas */}
        {filters.period === "custom" && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Fecha inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? (
                        format(startDate, "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Fecha final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? (
                        format(endDate, "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      locale={es}
                      disabled={(date) =>
                        startDate ? date < startDate : false
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Button
              onClick={handleApplyCustomDates}
              disabled={!startDate || !endDate}
              className="w-full"
            >
              Aplicar fechas
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
