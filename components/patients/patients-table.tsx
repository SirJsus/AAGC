"use client";

import { Patient, Clinic, Doctor } from "@prisma/client";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PatientEditDialog } from "./patient-edit-dialog";
import { PatientCreateDialog } from "./patient-create-dialog";
import { useRouter } from "next/navigation";

interface PatientWithRelations extends Patient {
  clinic?: Clinic | null;
  doctor?: (Doctor & { user?: { firstName: string; lastName: string } }) | null;
}

interface PatientsTableProps {
  patients: PatientWithRelations[];
  canEdit?: boolean;
}

export function PatientsTable({
  patients,
  canEdit = true,
}: PatientsTableProps) {
  const router = useRouter();
  const { data: session } = useSession() || {};
  const [searchTerm, setSearchTerm] = useState("");

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

  const filteredPatients =
    patients?.filter(
      (patient) =>
        patient?.firstName
          ?.toLowerCase?.()
          ?.includes?.(searchTerm?.toLowerCase?.() ?? "") ||
        patient?.lastName
          ?.toLowerCase?.()
          ?.includes?.(searchTerm?.toLowerCase?.() ?? "") ||
        patient?.customId
          ?.toLowerCase?.()
          ?.includes?.(searchTerm?.toLowerCase?.() ?? "") ||
        patient?.phone?.includes?.(searchTerm ?? "")
    ) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Patients ({filteredPatients?.length || 0})
          </CardTitle>
          {canEdit && <PatientCreateDialog onSuccess={handlePatientUpdated} />}
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
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
            {filteredPatients?.map((patient) => (
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
        {(!filteredPatients || filteredPatients.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm
              ? "No patients found matching your search."
              : "No patients found. Add your first patient to get started."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
