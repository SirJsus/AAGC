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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createClinic } from "@/lib/actions/clinics";
import { Plus } from "lucide-react";
import { ClinicSchedulesManager } from "./clinic-schedules-manager";
import { Clinic } from "@prisma/client";

interface ClinicCreateDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function ClinicCreateDialog({
  trigger,
  onSuccess,
}: ClinicCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createdClinic, setCreatedClinic] = useState<Clinic | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    // timezone will be stored in selectedTimezone below
    locale: "es-MX",
    defaultSlotMinutes: 30,
    clinicAcronym: "P",
  });
  const TIMEZONES: Record<string, string[]> = {
    Mexico: [
      "America/Tijuana",
      "America/Hermosillo",
      "America/Chihuahua",
      "America/Mazatlan",
      "America/Mexico_City",
      "America/Monterrey",
      "America/Merida",
      "America/Ojinaga",
    ],
    USA: [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "America/Anchorage",
    ],
    Spain: ["Europe/Madrid"],
  };

  const [selectedCountry, setSelectedCountry] = useState<string>("Mexico");
  const [selectedTimezone, setSelectedTimezone] = useState<string>(
    TIMEZONES["Mexico"][4]
  );

  // Reset form state whenever the dialog is opened so fields are blank on open
  useEffect(() => {
    if (open) {
      setFormData({
        name: "",
        address: "",
        phone: "",
        email: "",
        // timezone will be stored in selectedTimezone below
        locale: "es-MX",
        defaultSlotMinutes: 30,
        clinicAcronym: "",
      });
      setSelectedCountry("Mexico");
      setSelectedTimezone(TIMEZONES["Mexico"][4]);
      setIsLoading(false);
    }
    // only run when open changes
  }, [open]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!formData.name.trim()) {
      toast.error("El nombre de la clínica es requerido");
      return;
    }

    setIsLoading(true);
    try {
      const newClinic = await createClinic({
        name: formData.name,
        address: formData.address || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        timezone: selectedTimezone,
        locale: formData.locale,
        defaultSlotMinutes: Number(formData.defaultSlotMinutes),
        clinicAcronym: formData.clinicAcronym,
      });
      toast.success("Clínica creada correctamente");
      setOpen(false);
      setCreatedClinic(newClinic);
      setScheduleDialogOpen(true);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Error al crear la clínica");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
        <DialogTrigger asChild>
          {trigger || (
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Clínica
            </Button>
          )}
        </DialogTrigger>

        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear Clínica</DialogTitle>
            <DialogDescription>
              Agrega una nueva clínica al sistema
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="clinic-name">Nombre</Label>
              <Input
                id="clinic-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Nombre de la clínica"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinic-address">Dirección</Label>
              <Textarea
                id="clinic-address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Dirección"
                className="min-h-[56px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-phone">Teléfono</Label>
                <Input
                  id="clinic-phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="Teléfono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clinic-email">Email</Label>
                <Input
                  id="clinic-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="contacto@clinica.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-timezone">Zona horaria</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={selectedCountry}
                    onValueChange={(value) => {
                      setSelectedCountry(value);
                      const tzs = TIMEZONES[value];
                      setSelectedTimezone(tzs && tzs.length > 0 ? tzs[0] : "");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(TIMEZONES).map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedTimezone}
                    onValueChange={(value) => setSelectedTimezone(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(TIMEZONES[selectedCountry] || []).map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace("_", " ").split("/").slice(1).join("/")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clinic-slot">Minutos por turno</Label>
                <Input
                  id="clinic-slot"
                  type="number"
                  value={String(formData.defaultSlotMinutes)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultSlotMinutes: Number(e.target.value) || 30,
                    })
                  }
                  min={5}
                  max={120}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinic-acronym">Acrónimo de la Clínica</Label>
              <Input
                id="clinic-acronym"
                value={formData.clinicAcronym}
                onChange={(e) =>
                  setFormData({ ...formData, clinicAcronym: e.target.value })
                }
                placeholder="CE1"
                maxLength={5}
              />
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creando..." : "Crear Clínica"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {createdClinic && (
        <ClinicSchedulesManager
          clinic={createdClinic}
          open={scheduleDialogOpen}
          onOpenChange={(isOpen) => {
            setScheduleDialogOpen(isOpen);
            if (!isOpen) {
              setCreatedClinic(null);
            }
          }}
          onSuccess={() => {
            setScheduleDialogOpen(false);
            setCreatedClinic(null);
          }}
        />
      )}
    </>
  );
}
