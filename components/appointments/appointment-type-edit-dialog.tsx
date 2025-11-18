"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit } from "lucide-react";
import { toast } from "sonner";
import { updateAppointmentType } from "@/lib/actions/appointment-types";
import { Clinic } from "@prisma/client";
import { AppointmentTypeForClient } from "@/types/appointments";

interface AppointmentTypeWithClinic extends AppointmentTypeForClient {
  clinic?: Clinic | null;
}

interface AppointmentTypeEditDialogProps {
  appointmentType: AppointmentTypeWithClinic;
  clinics: Clinic[];
  userRole?: string;
  onSuccess?: () => void;
}

export function AppointmentTypeEditDialog({
  appointmentType,
  clinics,
  userRole,
  onSuccess,
}: AppointmentTypeEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: appointmentType.name,
    clinicId: appointmentType.clinicId,
    durationMin: appointmentType.durationMin.toString(),
    price: appointmentType.price.toString(),
    preInstructions: appointmentType.preInstructions || "",
  });

  // Reset form when appointment type changes
  useEffect(() => {
    setFormData({
      name: appointmentType.name,
      clinicId: appointmentType.clinicId,
      durationMin: appointmentType.durationMin.toString(),
      price: appointmentType.price.toString(),
      preInstructions: appointmentType.preInstructions || "",
    });
  }, [appointmentType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación de nombre
    if (!formData.name?.trim()) {
      toast.error("Por favor ingresa el nombre del tipo de cita");
      return;
    }

    if (formData.name.trim().length < 3) {
      toast.error("El nombre debe tener al menos 3 caracteres");
      return;
    }

    if (formData.name.trim().length > 100) {
      toast.error("El nombre es demasiado largo (máximo 100 caracteres)");
      return;
    }

    // Validación de clínica
    if (!formData.clinicId) {
      toast.error("Por favor selecciona una clínica");
      return;
    }

    // Validación de duración
    const duration = parseInt(formData.durationMin);
    if (isNaN(duration)) {
      toast.error("Por favor ingresa una duración válida");
      return;
    }

    if (duration < 5) {
      toast.error("La duración mínima es de 5 minutos");
      return;
    }

    if (duration > 480) {
      toast.error("La duración máxima es de 480 minutos (8 horas)");
      return;
    }

    // Validación de precio si se proporciona
    if (formData.price) {
      const price = parseFloat(formData.price);
      if (isNaN(price)) {
        toast.error("Por favor ingresa un precio válido");
        return;
      }

      if (price < 0) {
        toast.error("El precio no puede ser negativo");
        return;
      }

      if (price > 999999.99) {
        toast.error("El precio es demasiado alto (máximo 999,999.99)");
        return;
      }
    }

    // Validación de instrucciones previas si se proporcionan
    if (
      formData.preInstructions &&
      formData.preInstructions.trim().length > 1000
    ) {
      toast.error(
        "Las instrucciones previas son demasiado largas (máximo 1000 caracteres)"
      );
      return;
    }

    setIsLoading(true);
    try {
      await updateAppointmentType(appointmentType.id, {
        name: formData.name.trim(),
        clinicId: formData.clinicId,
        durationMin: parseInt(formData.durationMin) || 30,
        price: formData.price ? parseFloat(formData.price) : 0,
        preInstructions: formData.preInstructions.trim() || undefined,
      });

      toast.success("Los datos del tipo de cita se guardaron correctamente");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el tipo de cita. Por favor, verifica los datos e intenta nuevamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Tipo de Cita</DialogTitle>
            <DialogDescription>
              Modifica los detalles del tipo de cita
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ej: Consulta General, Seguimiento, Revisión..."
                required
              />
            </div>

            {userRole === "ADMIN" && (
              <div className="space-y-2">
                <Label htmlFor="edit-clinic">
                  Clínica <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.clinicId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, clinicId: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una clínica" />
                  </SelectTrigger>
                  <SelectContent>
                    {clinics.map((clinic) => (
                      <SelectItem key={clinic.id} value={clinic.id}>
                        {clinic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-duration">
                  Duración (minutos) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-duration"
                  type="number"
                  min="5"
                  max="480"
                  value={formData.durationMin}
                  onChange={(e) =>
                    setFormData({ ...formData, durationMin: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-price">Precio</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-instructions">Instrucciones Previas</Label>
              <Textarea
                id="edit-instructions"
                value={formData.preInstructions}
                onChange={(e) =>
                  setFormData({ ...formData, preInstructions: e.target.value })
                }
                placeholder="Instrucciones o recomendaciones antes de la cita..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
