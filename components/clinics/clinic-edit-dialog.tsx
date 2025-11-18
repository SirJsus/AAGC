"use client";

import { useEffect, useState } from "react";
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
import { updateClinic, setClinicActive } from "@/lib/actions/clinics";
import { Switch } from "@/components/ui/switch";
import { Clinic, Role } from "@prisma/client";
import { Pencil } from "lucide-react";

interface ClinicEditDialogProps {
  clinic: Clinic;
  userRole?: Role;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function ClinicEditDialog({
  clinic,
  userRole,
  trigger,
  onSuccess,
}: ClinicEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const canChangeStatus = userRole === Role.ADMIN;

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
    clinic?.timezone || TIMEZONES["Mexico"][4]
  );

  const [formData, setFormData] = useState({
    name: clinic?.name || "",
    address: clinic?.address || "",
    phone: clinic?.phone || "",
    email: clinic?.email || "",
    locale: clinic?.locale || "es-MX",
    defaultSlotMinutes: clinic?.defaultSlotMinutes ?? 30,
    clinicAcronym: clinic?.clinicAcronym || "",
  });

  // When opening, initialize form from clinic (in case the prop changes)
  useEffect(() => {
    if (open) {
      setFormData({
        name: clinic?.name || "",
        address: clinic?.address || "",
        phone: clinic?.phone || "",
        email: clinic?.email || "",
        locale: clinic?.locale || "es-MX",
        defaultSlotMinutes: clinic?.defaultSlotMinutes ?? 30,
        clinicAcronym: clinic?.clinicAcronym || "",
      });
      // try to pick a country that contains the clinic timezone
      const tz = clinic?.timezone || TIMEZONES["Mexico"][4];
      const country =
        Object.keys(TIMEZONES).find((c) => (TIMEZONES[c] || []).includes(tz)) ||
        "Mexico";
      setSelectedCountry(country);
      setSelectedTimezone(tz);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clinic]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Validación de nombre de clínica
    if (!formData.name?.trim()) {
      toast.error("Por favor ingresa el nombre de la clínica");
      return;
    }

    if (formData.name.trim().length < 3) {
      toast.error("El nombre de la clínica debe tener al menos 3 caracteres");
      return;
    }

    if (formData.name.trim().length > 100) {
      toast.error(
        "El nombre de la clínica es demasiado largo (máximo 100 caracteres)"
      );
      return;
    }

    // Validación de dirección si se proporciona
    if (formData.address && formData.address.trim().length > 500) {
      toast.error("La dirección es demasiado larga (máximo 500 caracteres)");
      return;
    }

    // Validación de teléfono si se proporciona
    if (formData.phone?.trim()) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(formData.phone)) {
        toast.error(
          "El número de teléfono solo debe contener números y los caracteres: + - ( ) espacios"
        );
        return;
      }
    }

    // Validación de email si se proporciona
    if (formData.email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error("Por favor ingresa un correo electrónico válido");
        return;
      }
    }

    // Validación de minutos por turno
    if (formData.defaultSlotMinutes < 5) {
      toast.error("Los minutos por turno deben ser al menos 5");
      return;
    }

    if (formData.defaultSlotMinutes > 120) {
      toast.error("Los minutos por turno no pueden ser más de 120");
      return;
    }

    // Validación de acrónimo de clínica si se proporciona
    if (formData.clinicAcronym?.trim()) {
      if (formData.clinicAcronym.length > 5) {
        toast.error(
          "El acrónimo de la clínica es demasiado largo (máximo 5 caracteres)"
        );
        return;
      }

      const acronymRegex = /^[A-Z0-9]+$/;
      if (!acronymRegex.test(formData.clinicAcronym)) {
        toast.error(
          "El acrónimo debe contener solo letras mayúsculas y números"
        );
        return;
      }
    }

    // Validación de zona horaria
    if (!selectedTimezone) {
      toast.error("Por favor selecciona una zona horaria");
      return;
    }

    setIsLoading(true);
    try {
      await updateClinic(clinic.id, {
        name: formData.name,
        address: formData.address || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        timezone: selectedTimezone,
        locale: formData.locale,
        defaultSlotMinutes: Number(formData.defaultSlotMinutes),
        clinicAcronym: formData.clinicAcronym,
      });
      toast.success("Los datos de la clínica se guardaron correctamente");
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(
        err?.message ||
          "No se pudo actualizar la clínica. Por favor, verifica los datos e intenta nuevamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (value: boolean) => {
    setIsLoading(true);
    try {
      await setClinicActive(clinic.id, value);
      toast.success(
        value
          ? "La clínica se activó correctamente"
          : "La clínica se desactivó correctamente"
      );
      onSuccess?.();
    } catch (err: any) {
      toast.error(
        err?.message ||
          "No se pudo cambiar el estado de la clínica. Por favor, intenta nuevamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Clínica</DialogTitle>
          <DialogDescription>
            Modifica los datos de la clínica
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
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

            <div className="w-1/5 flex-shrink-0 flex flex-col items-center justify-center text-center">
              <h4 className="text-sm font-medium">Estado</h4>
              <div className="flex items-center gap-3 mt-2">
                <Switch
                  checked={!!clinic.isActive}
                  onCheckedChange={async (checked) =>
                    await handleToggleActive(Boolean(checked))
                  }
                  disabled={!canChangeStatus}
                />
              </div>
              <div className="text-sm">
                {clinic.isActive ? "Activo" : "Inactivo"}
              </div>
              {!canChangeStatus && (
                <div className="text-xs text-muted-foreground mt-1">
                  Solo ADMIN
                </div>
              )}
            </div>
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
              placeholder="P"
              maxLength={5}
            />
          </div>

          <div className="space-y-2">
            <div>
              <h4 className="text-sm font-medium">Metadatos</h4>
              <div className="text-sm text-muted-foreground mt-2">
                <div>
                  ID: <span className="font-mono">{clinic.id}</span>
                </div>
                <div>
                  Creado:{" "}
                  {clinic.createdAt
                    ? new Date(clinic.createdAt).toLocaleString()
                    : "—"}
                </div>
                <div>
                  Actualizado:{" "}
                  {clinic.updatedAt
                    ? new Date(clinic.updatedAt).toLocaleString()
                    : "—"}
                </div>
                <div>
                  Eliminado:{" "}
                  {clinic.deletedAt
                    ? new Date(clinic.deletedAt).toLocaleString()
                    : "—"}
                </div>
              </div>
            </div>
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
              {isLoading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ClinicEditDialog;
