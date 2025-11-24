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
import type { ReportFilters } from "./reports-container";

interface ReportsFiltersProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  clinicId?: string | null;
  userRole: string;
}

export function ReportsFilters({
  filters,
  onFiltersChange,
  clinicId,
  userRole,
}: ReportsFiltersProps) {
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [appointmentTypes, setAppointmentTypes] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  useEffect(() => {
    // Determinar la clínica a filtrar
    // - Para ADMIN: usa la clínica seleccionada en filters.clinicId (si existe)
    // - Para CLINIC_ADMIN: usa su clinicId asignado
    const filterClinicId = userRole === "ADMIN" ? filters.clinicId : clinicId;

    // Cargar clínicas si es ADMIN
    if (userRole === "ADMIN") {
      fetch("/api/clinics")
        .then((res) => res.json())
        .then((data) => {
          const clinicsList = data.map((c: any) => ({
            id: c.id,
            name: c.name,
          }));
          setClinics(clinicsList);
        })
        .catch(console.error);
    }

    // Cargar doctores según la clínica
    const doctorsUrl = filterClinicId
      ? `/api/doctors?clinicId=${filterClinicId}`
      : "/api/doctors";

    fetch(doctorsUrl)
      .then((res) => res.json())
      .then((data) => {
        const doctorsList = data.map((d: any) => ({
          id: d.id,
          name: `${d.user.firstName} ${d.user.lastName}`,
        }));
        setDoctors(doctorsList);

        // Si el doctor seleccionado no está en la nueva lista, resetear a "all"
        if (filters.doctorId && filters.doctorId !== "all") {
          const doctorExists = doctorsList.some(
            (d: any) => d.id === filters.doctorId
          );
          if (!doctorExists) {
            onFiltersChange({ ...filters, doctorId: "all" });
          }
        }
      })
      .catch(console.error);

    // Cargar tipos de cita según la clínica
    const typesUrl = filterClinicId
      ? `/api/appointment-types?clinicId=${filterClinicId}`
      : "/api/appointment-types";

    fetch(typesUrl)
      .then((res) => res.json())
      .then((data) => {
        const typesList = data.map((t: any) => ({
          id: t.id,
          name: t.name,
        }));
        setAppointmentTypes(typesList);

        // Si el tipo de cita seleccionado no está en la nueva lista, resetear a "all"
        if (filters.appointmentTypeId && filters.appointmentTypeId !== "all") {
          const typeExists = typesList.some(
            (t: any) => t.id === filters.appointmentTypeId
          );
          if (!typeExists) {
            onFiltersChange({ ...filters, appointmentTypeId: "all" });
          }
        }
      })
      .catch(console.error);
  }, [clinicId, userRole, filters.clinicId]);

  const handlePeriodChange = (period: string) => {
    const newFilters = {
      ...filters,
      period: period as ReportFilters["period"],
    };
    if (period !== "custom") {
      delete newFilters.startDate;
      delete newFilters.endDate;
      setStartDate(undefined);
      setEndDate(undefined);
    }
    onFiltersChange(newFilters);
  };

  const handleDateRangeApply = () => {
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
          Filtros de Reporte
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Clínica (solo para ADMIN) */}
          {userRole === "ADMIN" && (
            <div className="space-y-2">
              <Label>Clínica</Label>
              <Select
                value={filters.clinicId || "all"}
                onValueChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    clinicId: value === "all" ? undefined : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las clínicas" />
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

          {/* Período */}
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={filters.period} onValueChange={handlePeriodChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Hoy</SelectItem>
                <SelectItem value="week">Esta Semana</SelectItem>
                <SelectItem value="month">Este Mes</SelectItem>
                <SelectItem value="year">Este Año</SelectItem>
                <SelectItem value="custom">Rango Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Doctor */}
          <div className="space-y-2">
            <Label>Doctor</Label>
            <Select
              value={filters.doctorId}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, doctorId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los doctores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los doctores</SelectItem>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </SelectItem>
                ))}
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

          {/* Rango de fechas personalizado */}
          {filters.period === "custom" && (
            <div className="space-y-2 lg:col-span-2">
              <Label>Rango de Fechas</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate
                        ? format(startDate, "PPP", { locale: es })
                        : "Fecha inicio"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate
                        ? format(endDate, "PPP", { locale: es })
                        : "Fecha fin"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  onClick={handleDateRangeApply}
                  disabled={!startDate || !endDate}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
