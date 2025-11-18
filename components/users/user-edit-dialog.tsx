"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelect } from "@/components/ui/multi-select";
import { updateUser } from "@/lib/actions/users";
import { toast } from "sonner";
import { Edit, User, Stethoscope } from "lucide-react";
import { Role } from "@prisma/client";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  secondLastName?: string | null;
  noSecondLastName?: boolean | null;
  phone?: string | null;
  role: Role;
  clinicId?: string | null;
  isActive: boolean;
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

interface UserEditDialogProps {
  user: User;
  clinics: { id: string; name: string }[];
  rooms: { id: string; name: string; clinicId: string }[];
  specialties: { id: string; name: string }[];
  currentUserRole: Role;
  currentUserClinicId?: string | null;
}

export function UserEditDialog({
  user,
  clinics,
  rooms,
  specialties,
  currentUserRole,
  currentUserClinicId,
}: UserEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  // Extract current specialty IDs and primary specialty
  const currentSpecialtyIds =
    user.doctor?.specialties?.map((s) => s.specialtyId) || [];
  const currentPrimarySpecialtyId =
    user.doctor?.specialties?.find((s) => s.isPrimary)?.specialtyId || "";

  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    secondLastName: user.secondLastName || "",
    noSecondLastName: user.noSecondLastName || false,
    phone: user.phone || "",
    role: user.role,
    clinicId: user.clinicId || "",
    isActive: user.isActive,
    licenseNumber: user.licenseNumber || "",
    acronym: user.doctor?.acronym || "",
    roomId: user.doctor?.roomId || "",
    specialtyIds: currentSpecialtyIds,
    primarySpecialtyId: currentPrimarySpecialtyId,
  });

  // Determine which roles can be assigned
  const availableRoles =
    currentUserRole === "ADMIN"
      ? ["ADMIN", "CLINIC_ADMIN", "RECEPTION", "NURSE", "DOCTOR"]
      : ["CLINIC_ADMIN", "RECEPTION", "NURSE", "DOCTOR"];

  const roleLabels: Record<string, string> = {
    ADMIN: "Administrador",
    CLINIC_ADMIN: "Administrador de Clínica",
    RECEPTION: "Recepcionista",
    NURSE: "Enfermero/a",
    DOCTOR: "Doctor",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación de nombre
    if (!formData.firstName?.trim()) {
      toast.error("Por favor ingresa el nombre del usuario");
      setActiveTab("general");
      return;
    }

    if (formData.firstName.trim().length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres");
      setActiveTab("general");
      return;
    }

    if (formData.firstName.trim().length > 100) {
      toast.error("El nombre es demasiado largo (máximo 100 caracteres)");
      setActiveTab("general");
      return;
    }

    // Validación de apellido paterno
    if (!formData.lastName?.trim()) {
      toast.error("Por favor ingresa el apellido paterno del usuario");
      setActiveTab("general");
      return;
    }

    if (formData.lastName.trim().length < 2) {
      toast.error("El apellido paterno debe tener al menos 2 caracteres");
      setActiveTab("general");
      return;
    }

    if (formData.lastName.trim().length > 100) {
      toast.error(
        "El apellido paterno es demasiado largo (máximo 100 caracteres)"
      );
      setActiveTab("general");
      return;
    }

    // Validación de apellido materno
    if (!formData.noSecondLastName && !formData.secondLastName?.trim()) {
      toast.error(
        "Por favor ingresa el apellido materno o marca la casilla si el usuario no tiene"
      );
      setActiveTab("general");
      return;
    }

    if (formData.secondLastName && formData.secondLastName.trim().length < 2) {
      toast.error("El apellido materno debe tener al menos 2 caracteres");
      setActiveTab("general");
      return;
    }

    if (
      formData.secondLastName &&
      formData.secondLastName.trim().length > 100
    ) {
      toast.error(
        "El apellido materno es demasiado largo (máximo 100 caracteres)"
      );
      setActiveTab("general");
      return;
    }

    // Validación de teléfono si se proporciona
    if (formData.phone?.trim()) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(formData.phone)) {
        toast.error(
          "El número de teléfono solo debe contener números y los caracteres: + - ( ) espacios"
        );
        setActiveTab("general");
        return;
      }
    }

    // Validación de clínica para administradores
    if (
      currentUserRole === "ADMIN" &&
      formData.role === "DOCTOR" &&
      !formData.clinicId
    ) {
      toast.error("Por favor selecciona una clínica para el doctor");
      setActiveTab("general");
      return;
    }

    // Validación adicional para doctores
    if (formData.role === "DOCTOR") {
      if (!formData.licenseNumber?.trim()) {
        toast.error(
          "Por favor ingresa el número de cédula profesional del doctor"
        );
        setActiveTab("doctor");
        return;
      }

      if (formData.licenseNumber.trim().length > 50) {
        toast.error(
          "El número de cédula es demasiado largo (máximo 50 caracteres)"
        );
        setActiveTab("doctor");
        return;
      }

      if (currentUserRole === "ADMIN" && !formData.clinicId) {
        toast.error("Por favor selecciona una clínica para el doctor");
        setActiveTab("general");
        return;
      }

      // Validación de acrónimo personalizado si se proporciona
      if (formData.acronym?.trim()) {
        if (formData.acronym.length !== 3) {
          toast.error("El acrónimo debe tener exactamente 3 caracteres");
          setActiveTab("doctor");
          return;
        }

        const acronymRegex = /^[A-Z]{3}$/;
        if (!acronymRegex.test(formData.acronym)) {
          toast.error(
            "El acrónimo debe contener solo 3 letras mayúsculas (A-Z)"
          );
          setActiveTab("doctor");
          return;
        }
      }
    }

    setLoading(true);

    try {
      await updateUser(user.id, {
        ...formData,
        clinicId: formData.clinicId || undefined,
        licenseNumber: formData.licenseNumber || undefined,
        acronym: formData.acronym || undefined,
        roomId: formData.roomId || undefined,
        specialtyIds:
          formData.role === "DOCTOR" ? formData.specialtyIds : undefined,
        primarySpecialtyId:
          formData.role === "DOCTOR" ? formData.primarySpecialtyId : undefined,
      });

      toast.success("Los datos del usuario se guardaron correctamente");
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      toast.error(
        error.message ||
          "No se pudo actualizar el usuario. Por favor, verifica los datos e intenta nuevamente."
      );
    } finally {
      setLoading(false);
    }
  };

  // Filter rooms by selected clinic
  const availableRooms = rooms.filter(
    (room) => room.clinicId === formData.clinicId
  );

  // Generate automatic acronym for display
  const generateAutoAcronym = () => {
    if (!formData.firstName || !formData.lastName) return "XX";
    const firstInitial = formData.firstName.charAt(0).toUpperCase();
    const lastInitial = formData.lastName.charAt(0).toUpperCase();
    const secondLastInitial =
      formData.secondLastName && !formData.noSecondLastName
        ? formData.secondLastName.charAt(0).toUpperCase()
        : "";
    return `${firstInitial}${lastInitial}${secondLastInitial}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>
            Modificar los datos del usuario: {user.email}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Datos Generales
              </TabsTrigger>
              <TabsTrigger
                value="doctor"
                disabled={formData.role !== "DOCTOR"}
                className="flex items-center gap-2"
              >
                <Stethoscope className="h-4 w-4" />
                Datos de Doctor
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre *</Label>
                <Input
                  id="firstName"
                  required
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  placeholder="Ej: Juan"
                  minLength={2}
                  title="Ingrese el nombre del usuario"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido Paterno *</Label>
                <Input
                  id="lastName"
                  required
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  placeholder="Ej: Pérez"
                  minLength={2}
                  title="Ingrese el apellido paterno"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondLastName">
                  Apellido Materno{" "}
                  {!formData.noSecondLastName && (
                    <span className="text-red-500">*</span>
                  )}
                </Label>
                <Input
                  id="secondLastName"
                  value={formData.secondLastName}
                  onChange={(e) =>
                    setFormData({ ...formData, secondLastName: e.target.value })
                  }
                  placeholder="Ej: García"
                  disabled={formData.noSecondLastName}
                  required={!formData.noSecondLastName}
                  minLength={formData.noSecondLastName ? 0 : 2}
                  title="Ingrese el apellido materno o marque que no tiene"
                />
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="noSecondLastName-edit"
                    checked={formData.noSecondLastName}
                    onCheckedChange={(checked) => {
                      setFormData({
                        ...formData,
                        noSecondLastName: checked as boolean,
                        secondLastName: checked ? "" : formData.secondLastName,
                      });
                    }}
                  />
                  <label
                    htmlFor="noSecondLastName-edit"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    No tiene apellido materno
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="Ej: +52 55 1234 5678"
                  title="Ingrese un número de teléfono válido"
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Se aceptan formatos internacionales, espacios y
                  guiones.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Rol *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value as Role })
                  }
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabels[role] || role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.role === "DOCTOR" && (
                  <p className="text-sm text-muted-foreground">
                    Complete también la pestaña "Datos de Doctor"
                  </p>
                )}
              </div>

              {currentUserRole === "ADMIN" && (
                <div className="space-y-2">
                  <Label htmlFor="clinicId">
                    Clínica{" "}
                    {formData.role === "DOCTOR" && (
                      <span className="text-red-500">*</span>
                    )}
                  </Label>
                  <Select
                    value={formData.clinicId || "none"}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        clinicId: value === "none" ? "" : value,
                        roomId: "",
                      })
                    }
                  >
                    <SelectTrigger id="clinicId">
                      <SelectValue placeholder="Seleccionar clínica (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin clínica asignada</SelectItem>
                      {clinics.map((clinic) => (
                        <SelectItem key={clinic.id} value={clinic.id}>
                          {clinic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive" className="text-base">
                    Usuario Activo
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.isActive
                      ? "El usuario puede acceder al sistema"
                      : "El usuario no puede acceder"}
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
            </TabsContent>

            <TabsContent value="doctor" className="space-y-4 mt-4">
              {formData.role === "DOCTOR" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="specialties">Especialidades</Label>
                    <MultiSelect
                      options={specialties.map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))}
                      selected={formData.specialtyIds}
                      onChange={(selected) =>
                        setFormData({
                          ...formData,
                          specialtyIds: selected,
                          // Si se deselecciona la especialidad principal, limpiar o usar la primera
                          primarySpecialtyId: selected.includes(
                            formData.primarySpecialtyId
                          )
                            ? formData.primarySpecialtyId
                            : selected[0] || "",
                        })
                      }
                      placeholder="Seleccionar especialidades"
                    />
                    <p className="text-xs text-muted-foreground">
                      Opcional. Puedes seleccionar múltiples especialidades
                      médicas.
                    </p>
                  </div>

                  {formData.specialtyIds.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="primarySpecialty">
                        Especialidad Principal
                      </Label>
                      <Select
                        value={
                          formData.primarySpecialtyId ||
                          formData.specialtyIds[0]
                        }
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            primarySpecialtyId: value,
                          })
                        }
                      >
                        <SelectTrigger id="primarySpecialty">
                          <SelectValue placeholder="Seleccionar especialidad principal" />
                        </SelectTrigger>
                        <SelectContent>
                          {formData.specialtyIds.map((specialtyId) => {
                            const specialty = specialties.find(
                              (s) => s.id === specialtyId
                            );
                            return (
                              <SelectItem key={specialtyId} value={specialtyId}>
                                {specialty?.name || specialtyId}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Esta será la especialidad que se mostrará por defecto
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">
                      Número de Cédula Profesional *
                    </Label>
                    <Input
                      id="licenseNumber"
                      required={formData.role === "DOCTOR"}
                      value={formData.licenseNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          licenseNumber: e.target.value,
                        })
                      }
                      placeholder="Ej: 12345678"
                      pattern="[0-9]{7,10}"
                      title="Ingrese el número de cédula profesional (7-10 dígitos)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Número de 7-10 dígitos. Ejemplo: 12345678
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="acronym">Acrónimo</Label>
                    <Input
                      id="acronym"
                      value={formData.acronym}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          acronym: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder={`Ej: DR, DRA (auto: ${generateAutoAcronym()})`}
                      maxLength={10}
                      pattern="[A-Za-z0-9]{1,10}"
                      title="Acrónimo de 1-10 caracteres alfanuméricos"
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.acronym
                        ? "Acrónimo personalizado para identificar al doctor"
                        : `Opcional. Si se deja vacío: ${generateAutoAcronym()}. Ejemplos: DR, DRA, DOC`}
                    </p>
                  </div>

                  {formData.clinicId && availableRooms.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="roomId">Consultorio por Defecto</Label>
                      <Select
                        value={formData.roomId || "none"}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            roomId: value === "none" ? "" : value,
                          })
                        }
                      >
                        <SelectTrigger id="roomId">
                          <SelectValue placeholder="Seleccionar consultorio (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            Sin consultorio asignado
                          </SelectItem>
                          {availableRooms.map((room) => (
                            <SelectItem key={room.id} value={room.id}>
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Consultorio predeterminado para las citas
                      </p>
                    </div>
                  )}

                  {formData.clinicId && availableRooms.length === 0 && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                      <p className="text-sm text-yellow-800">
                        No hay consultorios disponibles en esta clínica. Puedes
                        asignar uno más tarde.
                      </p>
                    </div>
                  )}

                  {!formData.clinicId && currentUserRole === "ADMIN" && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="text-sm text-blue-800">
                        Selecciona una clínica en "Datos Generales" para poder
                        asignar un consultorio.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-muted p-8 text-center">
                  <Stethoscope className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Selecciona el rol "Doctor" en la pestaña de Datos Generales
                    para completar esta sección
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
