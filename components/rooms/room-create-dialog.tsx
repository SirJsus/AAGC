"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createRoom } from "@/lib/actions/rooms";
import { getClinics } from "@/lib/actions/clinics";
import { Building2, Plus } from "lucide-react";
import type { Clinic } from "@prisma/client";
import { useSession } from "next-auth/react";

interface RoomCreateDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function RoomCreateDialog({
  trigger,
  onSuccess,
}: RoomCreateDialogProps) {
  const { data: session } = useSession() || {};
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const isAdmin = session?.user?.role === "ADMIN";

  const [formData, setFormData] = useState({
    name: "",
    clinicId: "",
    location: "",
    capacity: 1,
  });

  useEffect(() => {
    if (open) {
      loadClinics();
    }
  }, [open]);

  const loadClinics = async () => {
    try {
      const data = await getClinics();
      setClinics(data.clinics);

      // For non-admin users, automatically set their clinic
      if (!isAdmin && session?.user?.clinicId) {
        setFormData((prev) => ({
          ...prev,
          clinicId: session.user.clinicId || "",
        }));
      } else if (data.clinics.length === 1) {
        setFormData((prev) => ({ ...prev, clinicId: data.clinics[0].id }));
      }
    } catch (error) {
      toast.error(
        "No se pudo cargar la lista de clínicas. Por favor, intenta nuevamente."
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación de nombre del consultorio
    if (!formData.name?.trim()) {
      toast.error("Por favor ingresa el nombre del consultorio");
      return;
    }

    if (formData.name.trim().length < 2) {
      toast.error("El nombre del consultorio debe tener al menos 2 caracteres");
      return;
    }

    if (formData.name.trim().length > 100) {
      toast.error(
        "El nombre del consultorio es demasiado largo (máximo 100 caracteres)"
      );
      return;
    }

    // Validación de clínica
    if (!formData.clinicId) {
      toast.error("Por favor selecciona una clínica");
      return;
    }

    // Validación de ubicación si se proporciona
    if (formData.location && formData.location.trim().length > 200) {
      toast.error("La ubicación es demasiado larga (máximo 200 caracteres)");
      return;
    }

    // Validación de capacidad
    if (formData.capacity < 1) {
      toast.error("La capacidad debe ser al menos 1 persona");
      return;
    }

    if (formData.capacity > 100) {
      toast.error("La capacidad no puede ser mayor a 100 personas");
      return;
    }

    setIsLoading(true);
    try {
      await createRoom({
        name: formData.name,
        clinicId: formData.clinicId,
        location: formData.location,
        capacity: formData.capacity,
        isActive: true,
      });
      toast.success("El consultorio se creó correctamente");
      handleClose();
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo crear el consultorio. Por favor, verifica los datos e intenta nuevamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      const defaultClinicId =
        !isAdmin && session?.user?.clinicId
          ? session.user.clinicId
          : clinics.length === 1
            ? clinics[0].id
            : "";

      setFormData({
        name: "",
        clinicId: defaultClinicId,
        location: "",
        capacity: 1,
      });
    }, 200);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Consultorio
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Consultorio</DialogTitle>
          <DialogDescription>
            Agrega un nuevo consultorio a la clínica
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nombre del Consultorio <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Ej: Consultorio 1"
              required
            />
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="clinicId">
                Clínica <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.clinicId}
                onValueChange={(value) =>
                  setFormData({ ...formData, clinicId: value })
                }
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

          <div className="space-y-2">
            <Label htmlFor="location">Ubicación</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              placeholder="Ej: Piso 2, ala norte"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacidad</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              value={formData.capacity}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  capacity: parseInt(e.target.value) || 1,
                })
              }
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Creando..." : "Crear Consultorio"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
