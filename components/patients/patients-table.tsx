"use client";

import { Patient, Clinic, Doctor, Gender } from "@prisma/client";
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
  UserPlus,
  Search,
  FileText,
  Shield,
  Eye,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PatientEditDialog } from "./patient-edit-dialog";
import { PatientCreateDialog } from "./patient-create-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PatientWithRelations extends Patient {
  clinic?: Clinic | null;
  doctor?: (Doctor & { user?: { firstName: string; lastName: string } }) | null;
}

interface DoctorOption {
  id: string;
  user: {
    firstName: string;
    lastName: string;
  };
}

interface ClinicOption {
  id: string;
  name: string;
}

interface PatientsTableProps {
  patients: PatientWithRelations[];
  canEdit?: boolean;
  total: number;
  totalPages: number;
  currentPage: number;
  doctors: DoctorOption[];
  clinics: ClinicOption[];
}

export function PatientsTable({
  patients,
  canEdit = true,
  total,
  totalPages,
  currentPage,
  doctors,
  clinics,
}: PatientsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession() || {};
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || ""
  );
  const [status, setStatus] = useState(searchParams.get("status") || "active");
  const [gender, setGender] = useState(searchParams.get("gender") || "all");
  const [doctorId, setDoctorId] = useState(
    searchParams.get("doctorId") || "all"
  );
  const [clinicId, setClinicId] = useState(
    searchParams.get("clinicId") || "all"
  );
  const [pendingCompletion, setPendingCompletion] = useState(
    searchParams.get("pendingCompletion") || "all"
  );
  const pageSize = parseInt(searchParams.get("pageSize") || "20");

  // Restrict access for NURSE: they should not see the full patients list.
  // If you later want to show only "patients with appointments today",
  // that requires passing appointment data into this component.
  if (session?.user?.role === "NURSE") {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Patients
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No tienes acceso a la lista completa de pacientes.
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleDeletePatient = (patientId: string) => {
    alert(
      "Delete patient functionality will be implemented in the next iteration"
    );
  };

  const handlePatientUpdated = () => {
    router.refresh();
  };

  const updateFilters = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (status !== "all") params.set("status", status);
    if (gender !== "all") params.set("gender", gender);
    if (doctorId !== "all") params.set("doctorId", doctorId);
    if (clinicId !== "all") params.set("clinicId", clinicId);
    if (pendingCompletion !== "all")
      params.set("pendingCompletion", pendingCompletion);
    params.set("page", "1"); // Reset to page 1 when filters change

    startTransition(() => {
      router.push(`/patients?${params.toString()}`);
    });
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());

    startTransition(() => {
      router.push(`/patients?${params.toString()}`);
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
      router.push(`/patients?${params.toString()}`);
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
            <UserPlus className="h-5 w-5" />
            Pacientes ({total})
          </CardTitle>
          {canEdit && <PatientCreateDialog onSuccess={handlePatientUpdated} />}
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 pt-4">
          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, ID, teléfono o email..."
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

            {/* Gender Filter */}
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Género" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="MALE">Masculino</SelectItem>
                <SelectItem value="FEMALE">Femenino</SelectItem>
                <SelectItem value="OTHER">Otro</SelectItem>
              </SelectContent>
            </Select>

            {/* Doctor Filter */}
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los doctores</SelectItem>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    Dr. {doctor.user.firstName} {doctor.user.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clinic Filter - Only for ADMIN */}
            {session?.user?.role === "ADMIN" && (
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

            {/* Pending Completion Filter */}
            <Select
              value={pendingCompletion}
              onValueChange={setPendingCompletion}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Completado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Pendientes</SelectItem>
                <SelectItem value="false">Completados</SelectItem>
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
            {(searchTerm ||
              status !== "active" ||
              gender !== "all" ||
              doctorId !== "all" ||
              clinicId !== "all" ||
              pendingCompletion !== "all") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchTerm("");
                  setStatus("active");
                  setGender("all");
                  setDoctorId("all");
                  setClinicId("all");
                  setPendingCompletion("all");
                  startTransition(() => {
                    router.push("/patients");
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
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients?.map((patient) => (
              <TableRow key={patient?.id}>
                <TableCell className="font-medium">
                  {patient?.customId}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>
                      {patient?.firstName} {patient?.lastName}{" "}
                      {patient?.secondLastName}
                    </span>
                    {patient?.pendingCompletion && (
                      <Badge
                        variant="outline"
                        className="bg-yellow-50 text-yellow-700 border-yellow-200"
                      >
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Pendiente
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{patient?.phone}</TableCell>
                <TableCell>{patient?.email || "—"}</TableCell>
                <TableCell>
                  {patient?.doctor?.user
                    ? `${patient.doctor.user.firstName} ${patient.doctor.user.lastName}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={patient?.isActive ? "default" : "secondary"}>
                    {patient?.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {canEdit && (
                      <>
                        <Link href={`/patients/${patient?.id}/consents`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Consentimientos"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/patients/${patient?.id}/insurances`}>
                          <Button variant="ghost" size="sm" title="Seguros">
                            <Shield className="h-4 w-4" />
                          </Button>
                        </Link>
                        <PatientEditDialog
                          patient={patient}
                          onSuccess={handlePatientUpdated}
                          trigger={
                            <Button variant="ghost" size="sm" title="Editar">
                              <Edit className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <PatientEditDialog
                          patient={patient}
                          readOnly
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Visualizar"
                              aria-label="Visualizar paciente"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePatient(patient?.id || "")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {!canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Ver detalles"
                        onClick={() => router.push(`/patients/${patient?.id}`)}
                      >
                        Ver
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Empty State */}
        {(!patients || patients.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ||
            status !== "all" ||
            gender !== "all" ||
            doctorId !== "all" ||
            clinicId !== "all" ||
            pendingCompletion !== "all"
              ? "No se encontraron pacientes con los filtros aplicados."
              : "No hay pacientes registrados. Agrega tu primer paciente para comenzar."}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Mostrando{" "}
                {patients.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} a{" "}
                {Math.min(currentPage * pageSize, total)} de {total} pacientes
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
