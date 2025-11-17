"use client";

import { Room, Clinic } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Edit,
  Trash2,
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { RoomCreateDialog } from "./room-create-dialog";
import { RoomEditDialog } from "./room-edit-dialog";
import { deleteRoom } from "@/lib/actions/rooms";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

interface RoomWithRelations extends Room {
  clinic?: Clinic | null;
}

interface RoomsTableProps {
  rooms: RoomWithRelations[];
  clinics?: Clinic[];
  canManage?: boolean;
  total: number;
  totalPages: number;
  currentPage: number;
}

export function RoomsTable({
  rooms,
  clinics,
  canManage = true,
  total,
  totalPages,
  currentPage,
}: RoomsTableProps) {
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

  const isAdminView = Array.isArray(clinics) && clinics.length > 0;

  const handleRoomUpdated = () => {
    router.refresh();
  };

  const handleDeleteRoom = async (roomId: string) => {
    setDeletingId(roomId);
    try {
      await deleteRoom(roomId);
      toast.success("Consultorio eliminado exitosamente");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al eliminar consultorio"
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
      router.push(`/rooms?${params.toString()}`);
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());

    startTransition(() => {
      router.push(`/rooms?${params.toString()}`);
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
      router.push(`/rooms?${params.toString()}`);
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
            Consultorios ({total})
          </CardTitle>
          {canManage && <RoomCreateDialog onSuccess={handleRoomUpdated} />}
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 pt-4">
          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o ubicación..."
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
                    router.push("/rooms");
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
              <TableHead>Clínica</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Capacidad</TableHead>
              <TableHead>Estado</TableHead>
              {canManage && (
                <TableHead className="text-right">Acciones</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms?.map((room) => (
              <TableRow key={room?.id}>
                <TableCell className="font-medium">{room?.name}</TableCell>
                <TableCell>{room?.clinic?.name || "—"}</TableCell>
                <TableCell>{room?.location || "—"}</TableCell>
                <TableCell>{room?.capacity}</TableCell>
                <TableCell>
                  <Badge variant={room?.isActive ? "default" : "secondary"}>
                    {room?.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <RoomEditDialog
                        room={room}
                        onSuccess={handleRoomUpdated}
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={
                              deletingId === room?.id ||
                              room?.isActive === false
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              ¿Eliminar consultorio?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción marcará el consultorio como inactivo.
                              No se eliminará permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteRoom(room?.id || "")}
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Empty State */}
        {(!rooms || rooms.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm || status !== "all" || clinicId !== "all"
              ? "No se encontraron consultorios con los filtros aplicados."
              : "No hay consultorios registrados. Agrega tu primer consultorio para comenzar."}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Mostrando{" "}
                {rooms.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} a{" "}
                {Math.min(currentPage * pageSize, total)} de {total}{" "}
                consultorios
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
