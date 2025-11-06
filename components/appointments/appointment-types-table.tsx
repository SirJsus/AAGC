"use client";

import { useState } from "react";
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
import { Clock, DollarSign, Trash2, FileText } from "lucide-react";
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

interface AppointmentTypeWithClinic extends AppointmentTypeForClient {
  clinic?: Clinic | null;
}

interface AppointmentTypesTableProps {
  appointmentTypes: AppointmentTypeWithClinic[];
  clinics: Clinic[];
  userRole?: string;
  onUpdate: () => void;
}

export function AppointmentTypesTable({
  appointmentTypes,
  clinics,
  userRole,
  onUpdate,
}: AppointmentTypesTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  if (appointmentTypes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No hay tipos de citas configurados</p>
        <p className="text-sm mt-2">
          Crea tipos de cita para estandarizar tus servicios
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Duración</TableHead>
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
  );
}
