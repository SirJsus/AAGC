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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createUser } from "@/lib/actions/users";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, User, Stethoscope } from "lucide-react";
import { Role } from "@prisma/client";

interface UserCreateDialogProps {
  clinics: { id: string; name: string }[];
  rooms: { id: string; name: string; clinicId: string }[];
  currentUserRole: Role;
  currentUserClinicId?: string | null;
}

export function UserCreateDialog({
  clinics,
  rooms,
  currentUserRole,
  currentUserClinicId,
}: UserCreateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    secondLastName: "",
    noSecondLastName: false,
    phone: "",
    role: "RECEPTION" as Role,
    clinicId: currentUserRole === "ADMIN" ? "" : currentUserClinicId || "",
    // Doctor-specific fields
    specialty: "",
    licenseNumber: "",
    acronym: "",
    roomId: "",
  });

  // Determine which roles can be created
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

    // Validación adicional para doctores
    if (formData.role === "DOCTOR") {
      if (!formData.specialty || !formData.licenseNumber) {
        toast.error(
          "Por favor complete los campos requeridos en la pestaña 'Datos de Doctor'"
        );
        setActiveTab("doctor");
        setLoading(false);
        return;
      }
      if (currentUserRole === "ADMIN" && !formData.clinicId) {
        toast.error("Debe seleccionar una clínica para el doctor");
        setActiveTab("general");
        setLoading(false);
        return;
      }
    }

    setLoading(true);

    try {
      await createUser({
        ...formData,
        clinicId: formData.clinicId || undefined,
        specialty: formData.specialty || undefined,
        licenseNumber: formData.licenseNumber || undefined,
        acronym: formData.acronym || undefined,
        roomId: formData.roomId || undefined,
      });

      toast.success("Usuario creado exitosamente");
      setOpen(false);
      setActiveTab("general");
      setFormData({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        secondLastName: "",
        noSecondLastName: false,
        phone: "",
        role: "RECEPTION",
        clinicId: currentUserRole === "ADMIN" ? "" : currentUserClinicId || "",
        specialty: "",
        licenseNumber: "",
        acronym: "",
        roomId: "",
      });
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Error al crear usuario");
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
    if (!formData.firstName || !formData.lastName) return "DrXX";
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
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          <DialogDescription>
            Complete los datos del nuevo usuario del sistema
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
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="usuario@ejemplo.com"
                  title="Ingrese un correo electrónico válido"
                />
                <p className="text-xs text-muted-foreground">
                  Ejemplo: doctor@clinica.com
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="Mínimo 6 caracteres"
                    title="La contraseña debe tener al menos 6 caracteres"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mínimo 6 caracteres. Ejemplo: MiClave123
                </p>
              </div>

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
                  title="Ingrese el nombre del usuario"
                  minLength={2}
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
                  title="Ingrese el apellido paterno"
                  minLength={2}
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
                    id="noSecondLastName"
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
                    htmlFor="noSecondLastName"
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
                  onValueChange={(value) => {
                    setFormData({ ...formData, role: value as Role });
                    // Si selecciona DOCTOR y estamos en la pestaña general, cambiar a la pestaña de doctor
                    if (value === "DOCTOR") {
                      // No cambiar automáticamente, dejar que el usuario navegue
                    }
                  }}
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
            </TabsContent>

            <TabsContent value="doctor" className="space-y-4 mt-4">
              {formData.role === "DOCTOR" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="specialty">Especialidad *</Label>
                    <Input
                      id="specialty"
                      required={formData.role === "DOCTOR"}
                      value={formData.specialty}
                      onChange={(e) =>
                        setFormData({ ...formData, specialty: e.target.value })
                      }
                      placeholder="Ej: Cardiología"
                      minLength={3}
                      title="Ingrese la especialidad médica del doctor"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ejemplos: Cardiología, Pediatría, Traumatología, Medicina
                      General
                    </p>
                  </div>

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
              {loading ? "Creando..." : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
