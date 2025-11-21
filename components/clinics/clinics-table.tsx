"use client";

import { useState, useTransition } from "react";
import { Clinic, Role } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Building2,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { ClinicCreateDialog } from "@/components/clinics/clinic-create-dialog";
import ClinicEditDialog from "@/components/clinics/clinic-edit-dialog";
import { ClinicSchedulesManager } from "@/components/clinics/clinic-schedules-manager";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteClinic, hardDeleteClinic } from "@/lib/actions/clinics";
import { toast } from "sonner";

interface ClinicsTableProps {
  clinics: Clinic[];
  userRole: Role;
  userClinicId?: string | null;
  total: number;
  totalPages: number;
  currentPage: number;
}

export function ClinicsTable({
  clinics,
  userRole,
  userClinicId,
  total,
  totalPages,
  currentPage,
}: ClinicsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || ""
  );
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");

  // State for delete dialogs
  const [softDeleteDialogOpen, setSoftDeleteDialogOpen] = useState(false);
  const [hardDeleteDialogOpen, setHardDeleteDialogOpen] = useState(false);
  const [clinicToDelete, setClinicToDelete] = useState<Clinic | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = userRole === Role.ADMIN;
  const canCreateClinics = isAdmin;

  const canEditClinic = (clinicId: string) => {
    if (isAdmin) return true;
    return userClinicId === clinicId;
  };

  const handleSoftDelete = async () => {
    if (!clinicToDelete) return;

    setIsDeleting(true);
    try {
      await deleteClinic(clinicToDelete.id);
      toast.success("Clínica desactivada correctamente");
      setSoftDeleteDialogOpen(false);
      setClinicToDelete(null);
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Error al desactivar la clínica");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleHardDelete = async () => {
    if (!clinicToDelete) return;

    setIsDeleting(true);
    try {
      await hardDeleteClinic(clinicToDelete.id);
      toast.success("Clínica eliminada permanentemente");
      setHardDeleteDialogOpen(false);
      setClinicToDelete(null);
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Error al eliminar la clínica");
    } finally {
      setIsDeleting(false);
    }
  };

  const openSoftDeleteDialog = (clinic: Clinic) => {
    setClinicToDelete(clinic);
    setSoftDeleteDialogOpen(true);
  };

  const openHardDeleteDialog = (clinic: Clinic) => {
    setClinicToDelete(clinic);
    setHardDeleteDialogOpen(true);
  };

  const handleDeleteClinic = (clinicId: string) => {
    alert(
      "Delete clinic functionality will be implemented in the next iteration"
    );
  };

  const updateFilters = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (status !== "all") params.set("status", status);
    params.set("page", "1"); // Reset to page 1 when filters change

    startTransition(() => {
      router.push(`/clinics?${params.toString()}`);
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());

    startTransition(() => {
      router.push(`/clinics?${params.toString()}`);
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
      router.push(`/clinics?${params.toString()}`);
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
            <Building2 className="h-5 w-5" />
            Clínicas ({total})
          </CardTitle>
          {canCreateClinics && (
            <ClinicCreateDialog
              onSuccess={() => {
                router.refresh();
              }}
              trigger={
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Clínica
                </Button>
              }
            />
          )}
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 pt-4">
          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, dirección, teléfono o email..."
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

            {/* Apply Filters Button */}
            <Button
              variant="outline"
              onClick={updateFilters}
              disabled={isPending}
            >
              Aplicar Filtros
            </Button>

            {/* Reset Filters */}
            {(searchTerm || status !== "all") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchTerm("");
                  setStatus("all");
                  startTransition(() => {
                    router.push("/clinics");
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
              <TableHead>Dirección</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Zona Horaria</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinics?.map((clinic) => (
              <TableRow key={clinic?.id}>
                <TableCell className="font-medium">{clinic?.name}</TableCell>
                <TableCell>{clinic?.address || "—"}</TableCell>
                <TableCell>{clinic?.phone || "—"}</TableCell>
                <TableCell>{clinic?.timezone}</TableCell>
                <TableCell>
                  <Badge variant={clinic?.isActive ? "default" : "secondary"}>
                    {clinic?.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {canEditClinic(clinic?.id) && (
                      <>
                        <ClinicSchedulesManager
                          clinic={clinic}
                          trigger={
                            <Button
                              variant="outline"
                              size="sm"
                              title="Horarios"
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                          }
                          onSuccess={() => {
                            router.refresh();
                          }}
                        />
                        <ClinicEditDialog
                          clinic={clinic}
                          userRole={userRole}
                          trigger={
                            <Button variant="ghost" size="sm" title="Editar">
                              <Edit className="h-4 w-4" />
                            </Button>
                          }
                          onSuccess={() => {
                            router.refresh();
                          }}
                        />
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Desactivar clínica"
                          onClick={() => openSoftDeleteDialog(clinic)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openHardDeleteDialog(clinic)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Eliminar permanentemente"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Empty State */}
        {(!clinics || clinics.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm || status !== "all"
              ? "No se encontraron clínicas con los filtros aplicados."
              : "No hay clínicas registradas. Crea tu primera clínica para comenzar."}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Mostrando{" "}
                {clinics.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} a{" "}
                {Math.min(currentPage * pageSize, total)} de {total} clínicas
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

      {/* Soft Delete Dialog */}
      <AlertDialog
        open={softDeleteDialogOpen}
        onOpenChange={setSoftDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              ¿Desactivar esta clínica?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                La clínica <strong>{clinicToDelete?.name}</strong> será marcada
                como inactiva y no aparecerá en las listas activas.
              </p>
              <p className="text-muted-foreground">
                Esta acción es reversible. Puedes reactivar la clínica más tarde
                si es necesario.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Los registros de la clínica (usuarios, doctores, pacientes,
                citas) se mantendrán intactos.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSoftDelete} disabled={isDeleting}>
              {isDeleting ? "Desactivando..." : "Desactivar clínica"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hard Delete Dialog */}
      <AlertDialog
        open={hardDeleteDialogOpen}
        onOpenChange={setHardDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              ¿Eliminar permanentemente esta clínica?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold">
                Esta acción es irreversible y eliminará permanentemente todos
                los datos de la clínica <strong>{clinicToDelete?.name}</strong>.
              </p>
              <p>Solo se puede realizar si la clínica no tiene:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Usuarios asignados</li>
                <li>Doctores registrados</li>
                <li>Pacientes registrados</li>
                <li>Citas programadas</li>
                <li>Consultorios configurados</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Si la clínica tiene registros relacionados, deberás eliminarlos
                primero o usar la desactivación (soft delete).
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHardDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? "Eliminando..." : "Eliminar permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
