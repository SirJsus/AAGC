"use client";

import {
  Doctor,
  Clinic,
  User,
  Room,
  DoctorSchedule,
  DoctorSpecialty,
  Specialty,
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
import {
  Plus,
  Edit,
  Trash2,
  Stethoscope,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DoctorWithRelations extends Doctor {
  clinic?: Clinic | null;
  user?: User | null;
  defaultRoom?: Room | null;
  schedules?: DoctorSchedule[];
  specialties?: (DoctorSpecialty & {
    specialty: Specialty;
  })[];
}

interface ClinicOption {
  id: string;
  name: string;
}

interface SpecialtyOption {
  id: string;
  name: string;
}

interface DoctorsTableProps {
  doctors: DoctorWithRelations[];
  canManage?: boolean;
  total: number;
  totalPages: number;
  currentPage: number;
  clinics: ClinicOption[];
  specialties: SpecialtyOption[];
}

export function DoctorsTable({
  doctors,
  canManage = true,
  total,
  totalPages,
  currentPage,
  clinics,
  specialties,
}: DoctorsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || ""
  );
  const [status, setStatus] = useState(searchParams.get("status") || "active");
  const [clinicId, setClinicId] = useState(
    searchParams.get("clinicId") || "all"
  );
  const [specialty, setSpecialty] = useState(
    searchParams.get("specialty") || "all"
  );
  const pageSize = parseInt(searchParams.get("pageSize") || "20");

  const getScheduleSummary = (schedules?: DoctorSchedule[]) => {
    if (!schedules || schedules.length === 0) {
      return "Sin horario";
    }

    const activeDays = schedules.filter((s) => s.isActive).length;
    return `${activeDays} día(s) programado(s)`;
  };

  const updateFilters = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (status !== "all") params.set("status", status);
    if (clinicId !== "all") params.set("clinicId", clinicId);
    if (specialty !== "all") params.set("specialty", specialty);
    params.set("page", "1"); // Reset to page 1 when filters change

    startTransition(() => {
      router.push(`/doctors?${params.toString()}`);
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());

    startTransition(() => {
      router.push(`/doctors?${params.toString()}`);
    });
  };

  const handleSearch = () => {
    updateFilters();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handlePageSizeChange = (newSize: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", newSize);
    params.set("page", "1"); // Reset to page 1 when page size changes

    startTransition(() => {
      router.push(`/doctors?${params.toString()}`);
    });
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 3) {
        // Near the beginning
        for (let i = 2; i <= Math.min(4, totalPages - 1); i++) {
          pages.push(i);
        }
        pages.push("...");
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push("...");
        for (let i = totalPages - 3; i < totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Doctores ({total})
          </CardTitle>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 pt-4">
          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, licencia, teléfono o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-8"
              />
            </div>
            <Button onClick={handleSearch} disabled={isPending}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />

            {/* Status Filter */}
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>

            {/* Clinic Filter (only if clinics available) */}
            {clinics.length > 0 && (
              <Select value={clinicId} onValueChange={setClinicId}>
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
            )}

            {/* Specialty Filter */}
            {specialties.length > 0 && (
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Especialidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {specialties.map((spec) => (
                    <SelectItem key={spec.id} value={spec.id}>
                      {spec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Apply Filters Button */}
            <Button
              variant="outline"
              onClick={updateFilters}
              disabled={isPending}
            >
              Aplicar Filtros
            </Button>

            {/* Reset Filters */}
            {(searchTerm ||
              status !== "active" ||
              clinicId !== "all" ||
              specialty !== "all") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchTerm("");
                  setStatus("active");
                  setClinicId("all");
                  setSpecialty("all");
                  startTransition(() => {
                    router.push("/doctors");
                  });
                }}
                disabled={isPending}
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Licencia</TableHead>
              <TableHead>Especialidad</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead>Estado</TableHead>
              {canManage && (
                <TableHead className="text-right">Acciones</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {doctors?.map((doctor) => (
              <TableRow key={doctor?.id}>
                <TableCell className="font-medium">
                  Dr. {doctor?.user?.firstName} {doctor?.user?.lastName}
                </TableCell>
                <TableCell>{doctor?.user?.licenseNumber}</TableCell>
                <TableCell>
                  {doctor?.specialties && doctor.specialties.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {doctor.specialties
                        .sort(
                          (a, b) =>
                            (b.isPrimary ? 1 : -1) - (a.isPrimary ? 1 : -1)
                        )
                        .map((ds) => (
                          <Badge
                            key={ds.id}
                            variant={ds.isPrimary ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {ds.specialty.name}
                            {ds.isPrimary && " ⭐"}
                          </Badge>
                        ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{doctor?.user?.phone || "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {getScheduleSummary(doctor?.schedules)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={doctor?.isActive ? "default" : "secondary"}>
                    {doctor?.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Botones de acción si es necesario implementar */}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Empty State */}
        {(!doctors || doctors.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ||
            status !== "all" ||
            clinicId !== "all" ||
            specialty !== "all"
              ? "No se encontraron doctores con los filtros aplicados."
              : "No hay doctores registrados. Agrega tu primer doctor para comenzar."}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Mostrando{" "}
                {doctors.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} a{" "}
                {Math.min(currentPage * pageSize, total)} de {total} doctores
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Por página:
                </span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={handlePageSizeChange}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* First Page */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1 || isPending}
                title="Primera página"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>

              {/* Previous Page */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isPending}
                title="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Page Numbers */}
              {getPageNumbers().map((page, index) => {
                if (page === "...") {
                  return (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-2 text-muted-foreground"
                    >
                      ...
                    </span>
                  );
                }

                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page as number)}
                    disabled={isPending}
                    className="min-w-[40px]"
                  >
                    {page}
                  </Button>
                );
              })}

              {/* Next Page */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isPending}
                title="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* Last Page */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages || isPending}
                title="Última página"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
