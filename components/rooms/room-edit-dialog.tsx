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
import { Switch } from "@/components/ui/switch";
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
import { updateRoom } from "@/lib/actions/rooms";
import { getClinics } from "@/lib/actions/clinics";
import type { Room, Clinic } from "@prisma/client";
import { useSession } from "next-auth/react";

interface RoomWithRelations extends Room {
  clinic?: Clinic | null;
}

interface RoomEditDialogProps {
  room: RoomWithRelations;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function RoomEditDialog({
  room,
  trigger,
  onSuccess,
}: RoomEditDialogProps) {
  const { data: session } = useSession() || {};
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const isAdmin = session?.user?.role === "ADMIN";

  const [formData, setFormData] = useState({
    name: room.name,
    clinicId: room.clinicId,
    location: room.location || "",
    capacity: room.capacity,
    isActive: room.isActive ?? true,
  });

  useEffect(() => {
    if (open) {
      loadClinics();
    }
  }, [open]);

  const loadClinics = async () => {
    try {
      const data = await getClinics();
      setClinics(data);
    } catch (error) {
      toast.error("Error al cargar clínicas");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.clinicId) {
      toast.error("Por favor completa los campos requeridos");
      return;
    }

    setIsLoading(true);
    try {
      await updateRoom(room.id, {
        name: formData.name,
        clinicId: formData.clinicId,
        location: formData.location || undefined,
        capacity: formData.capacity,
        isActive: formData.isActive,
      });
      toast.success("Consultorio actualizado exitosamente");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al actualizar consultorio"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
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
        {trigger || <Button>Editar Consultorio</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Consultorio</DialogTitle>
          <DialogDescription>
            Actualiza la información del consultorio
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nombre del Consultorio <span className="text-red-500">*</span>
            </Label>
            <div>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ej: Consultorio 1"
                required
              />

              <div className="flex items-center justify-between space-x-2 rounded-lg border p-4 mt-3">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive" className="text-base">
                    Consultorio Activo
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.isActive
                      ? "El consultorio puede recibir citas"
                      : "El consultorio está inactivo"}
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
              </div>
            </div>
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
              {isLoading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
