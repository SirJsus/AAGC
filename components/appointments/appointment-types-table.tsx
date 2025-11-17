"use client";

import { useState, useTransition } from "react";
import { Clinic } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  DollarSign,
  Trash2,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { deleteAppointmentType } from "@/lib/actions/appointment-types";
import { AppointmentTypeEditDialog } from "./appointment-type-edit-dialog";
import { AppointmentTypeForClient } from "@/types/appointments";
import { useRouter, useSearchParams } from "next/navigation";

interface AppointmentTypeWithClinic extends AppointmentTypeForClient {
  clinic?: Clinic | null;
}

interface AppointmentTypesTableProps {
  appointmentTypes: AppointmentTypeWithClinic[];
  clinics: Clinic[];
  userRole?: string;
  onUpdate: () => void;
  total: number;
  totalPages: number;
  currentPage: number;
}

export function AppointmentTypesTable({
  appointmentTypes,
  clinics,
  userRole,
  onUpdate,
  total,
  totalPages,
  currentPage,
}: AppointmentTypesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || ""
  );
  const [status, setStatus] = useState(searchParams.get("status") || "active");
  const [clinicId, setClinicId] = useState(
    searchParams.get("clinicId") || "all"
  );
  const pageSize = parseInt(searchParams.get("pageSize") || "20");

  const isAdminView = userRole === "ADMIN";

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteAppointmentType(id);
      toast.success("Tipo de cita eliminado exitosamente");
      onUpdate();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al eliminar tipo de cita"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const updateFilters = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (status !== "all") params.set("status", status);
    if (clinicId !== "all") params.set("clinicId", clinicId);
    params.set("page", "1"); // Reset to page 1 when filters change

    startTransition(() => {
      router.push(`/appointment-types?${params.toString()}`);
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());

    startTransition(() => {
      router.push(`/appointment-types?${params.toString()}`);
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
      router.push(`/appointment-types?${params.toString()}`);
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

  if (appointmentTypes.length === 0) {
    return (
      <div>
        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o instrucciones..."
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

            {/* Clinic Filter (only for ADMIN) */}
            {isAdminView && (
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

            {/* Apply Filters Button */}
            <Button
              variant="outline"
              onClick={updateFilters}
              disabled={isPending}
            >
              Aplicar Filtros
            </Button>

            {/* Reset Filters */}
            {(searchTerm || status !== "active" || clinicId !== "all") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchTerm("");
                  setStatus("active");
                  setClinicId("all");
                  startTransition(() => {
                    router.push("/appointment-types");
                  });
                }}
                disabled={isPending}
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>

        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          {searchTerm || status !== "all" || clinicId !== "all" ? (
            <>
              <p>No se encontraron tipos de citas con los filtros aplicados</p>
              <p className="text-sm mt-2">
                Intenta ajustar los criterios de búsqueda
              </p>
            </>
          ) : (
            <>
              <p>No hay tipos de citas configurados</p>
              <p className="text-sm mt-2">
                Crea tipos de cita para estandarizar tus servicios
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Search and Filters */}
      <div className="space-y-4 mb-6">
        {/* Search Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o instrucciones..."
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

          {/* Clinic Filter (only for ADMIN) */}
          {isAdminView && (
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

          {/* Apply Filters Button */}
          <Button
            variant="outline"
            onClick={updateFilters}
            disabled={isPending}
          >
            Aplicar Filtros
          </Button>

          {/* Reset Filters */}
          {(searchTerm || status !== "active" || clinicId !== "all") && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearchTerm("");
                setStatus("active");
                setClinicId("all");
                startTransition(() => {
                  router.push("/appointment-types");
                });
              }}
              disabled={isPending}
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Duración Sugerida</TableHead>
              <TableHead>Precio</TableHead>
              {userRole === "ADMIN" && <TableHead>Clínica</TableHead>}
              <TableHead>Instrucciones</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointmentTypes.map((type) => (
              <TableRow key={type.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-4 w-4 text-blue-600" />
                    </div>
                    <span>{type.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono">
                    {type.durationMin} min
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 font-medium">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    {Number(type.price).toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </TableCell>
                {userRole === "ADMIN" && (
                  <TableCell className="text-sm text-muted-foreground">
                    {type.clinic?.name || "-"}
                  </TableCell>
                )}
                <TableCell className="max-w-xs">
                  {type.preInstructions ? (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground line-clamp-2">
                        {type.preInstructions}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <AppointmentTypeEditDialog
                      appointmentType={type}
                      clinics={clinics}
                      userRole={userRole}
                      onSuccess={onUpdate}
                    />

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === type.id}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará el tipo de cita "{type.name}".
                            Las citas existentes que usen este tipo no se verán
                            afectadas.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(type.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-4">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Mostrando{" "}
              {appointmentTypes.length > 0
                ? (currentPage - 1) * pageSize + 1
                : 0}{" "}
              a {Math.min(currentPage * pageSize, total)} de {total} tipos de
              citas
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Por página:</span>
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
    </div>
  );
}
