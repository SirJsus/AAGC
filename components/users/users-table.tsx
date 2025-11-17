"use client";

import { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserEditDialog } from "./user-edit-dialog";
import { PasswordResetDialog } from "./password-reset-dialog";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Role } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: Role;
  clinicId?: string | null;
  isActive: boolean;
  clinic?: { id: string; name: string } | null;
  specialty?: string | null;
  licenseNumber?: string | null;
  doctor?: {
    id: string;
    acronym: string;
    roomId?: string | null;
    specialties?: {
      id: string;
      specialtyId: string;
      isPrimary: boolean;
      specialty: {
        id: string;
        name: string;
      };
    }[];
  } | null;
}

interface UsersTableProps {
  users: User[];
  clinics: { id: string; name: string }[];
  rooms: { id: string; name: string; clinicId: string }[];
  specialties: { id: string; name: string }[];
  currentUserRole: Role;
  currentUserClinicId?: string | null;
  total: number;
  totalPages: number;
  currentPage: number;
}

export function UsersTable({
  users,
  clinics,
  rooms,
  specialties,
  currentUserRole,
  currentUserClinicId,
  total,
  totalPages,
  currentPage,
}: UsersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || ""
  );
  const [roleFilter, setRoleFilter] = useState(
    searchParams.get("role") || "all"
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "all"
  );
  const [clinicFilter, setClinicFilter] = useState(
    searchParams.get("clinicId") || "all"
  );
  const pageSize = parseInt(searchParams.get("pageSize") || "20");

  const roleLabels: Record<string, string> = {
    ADMIN: "Administrador",
    CLINIC_ADMIN: "Admin. Clínica",
    RECEPTION: "Recepcionista",
    NURSE: "Enfermero/a",
    DOCTOR: "Doctor",
  };

  const roleColors: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    ADMIN: "destructive",
    CLINIC_ADMIN: "default",
    RECEPTION: "secondary",
    NURSE: "outline",
    DOCTOR: "default",
  };

  const updateFilters = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (clinicFilter !== "all") params.set("clinicId", clinicFilter);
    params.set("page", "1"); // Reset to page 1 when filters change

    startTransition(() => {
      router.push(`/users?${params.toString()}`);
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());

    startTransition(() => {
      router.push(`/users?${params.toString()}`);
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
      router.push(`/users?${params.toString()}`);
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
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email o teléfono..."
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

          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="ADMIN">Administrador</SelectItem>
              <SelectItem value="CLINIC_ADMIN">Admin. Clínica</SelectItem>
              <SelectItem value="RECEPTION">Recepcionista</SelectItem>
              <SelectItem value="NURSE">Enfermero/a</SelectItem>
              <SelectItem value="DOCTOR">Doctor</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
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
          {currentUserRole === "ADMIN" && (
            <Select value={clinicFilter} onValueChange={setClinicFilter}>
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
                <SelectItem value="none">Sin clínica</SelectItem>
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
            roleFilter !== "all" ||
            statusFilter !== "all" ||
            clinicFilter !== "all") && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearchTerm("");
                setRoleFilter("all");
                setStatusFilter("all");
                setClinicFilter("all");
                startTransition(() => {
                  router.push("/users");
                });
              }}
              disabled={isPending}
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Clínica</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  {searchTerm ||
                  roleFilter !== "all" ||
                  statusFilter !== "all" ||
                  clinicFilter !== "all"
                    ? "No se encontraron usuarios con los filtros aplicados"
                    : "No se encontraron usuarios"}
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm">
                          {user.firstName.charAt(0)}
                          {user.lastName.charAt(0)}
                        </span>
                      </div>
                      <div className="font-medium">
                        {user.firstName} {user.lastName}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.phone || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleColors[user.role] || "outline"}>
                      {roleLabels[user.role] || user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.clinic?.name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <UserEditDialog
                        user={user}
                        clinics={clinics}
                        rooms={rooms}
                        specialties={specialties}
                        currentUserRole={currentUserRole}
                        currentUserClinicId={currentUserClinicId}
                      />
                      <PasswordResetDialog
                        userId={user.id}
                        userEmail={user.email}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Mostrando{" "}
              {users.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} a{" "}
              {Math.min(currentPage * pageSize, total)} de {total} usuarios
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
