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
import { MultiSelect } from "@/components/ui/multi-select";
import { createUser } from "@/lib/actions/users";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, User, Stethoscope } from "lucide-react";
import { Role } from "@prisma/client";

interface UserCreateDialogProps {
  clinics: { id: string; name: string }[];
  rooms: { id: string; name: string; clinicId: string }[];
  specialties: { id: string; name: string }[];
  currentUserRole: Role;
  currentUserClinicId?: string | null;
}

export function UserCreateDialog({
  clinics,
  rooms,
  specialties,
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
    specialtyIds: [] as string[], // Array de IDs de especialidades
    primarySpecialtyId: "", // ID de la especialidad principal
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

    // Validación de campos requeridos básicos
    if (!formData.email?.trim()) {
      toast.error("Por favor ingresa el correo electrónico del usuario");
      setActiveTab("general");
      return;
    }

    // Validación de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Por favor ingresa un correo electrónico válido");
      setActiveTab("general");
      return;
    }

    if (!formData.password?.trim()) {
      toast.error("Por favor ingresa una contraseña");
      setActiveTab("general");
      return;
    }

    // Validar contraseña con mensajes específicos
    if (formData.password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      setActiveTab("general");
      return;
    }
    if (!/[a-z]/.test(formData.password)) {
      toast.error("La contraseña debe contener al menos una letra minúscula");
      setActiveTab("general");
      return;
    }
    if (!/[A-Z]/.test(formData.password)) {
      toast.error("La contraseña debe contener al menos una letra mayúscula");
      setActiveTab("general");
      return;
    }
    if (!/[0-9]/.test(formData.password)) {
      toast.error("La contraseña debe contener al menos un número");
      setActiveTab("general");
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password)) {
      toast.error(
        "La contraseña debe contener al menos un carácter especial (!@#$%^&*...)"
      );
      setActiveTab("general");
      return;
    }

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
    if (currentUserRole === "ADMIN" && !formData.clinicId) {
      toast.error("Por favor selecciona una clínica para el usuario");
      setActiveTab("general");
      return;
    }

    // Validación adicional para doctores
    if (formData.role === "DOCTOR") {
      if (formData.specialtyIds.length === 0) {
        toast.error(
          "Por favor selecciona al menos una especialidad para el doctor"
        );
        setActiveTab("doctor");
        return;
      }

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
      await createUser({
        ...formData,
        clinicId: formData.clinicId || undefined,
        specialtyIds:
          formData.specialtyIds.length > 0 ? formData.specialtyIds : undefined,
        primarySpecialtyId: formData.primarySpecialtyId || undefined,
        licenseNumber: formData.licenseNumber || undefined,
        acronym: formData.acronym || undefined,
        roomId: formData.roomId || undefined,
      });

      toast.success("El usuario se creó correctamente");
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
        specialtyIds: [],
        primarySpecialtyId: "",
        licenseNumber: "",
        acronym: "",
        roomId: "",
      });
      router.refresh();
    } catch (error: any) {
      toast.error(
        error.message ||
          "No se pudo crear el usuario. Por favor, verifica los datos e intenta nuevamente."
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
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

            <TabsContent value="general" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Columna 1 */}
                <div className="space-y-4">
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
                        setFormData({
                          ...formData,
                          secondLastName: e.target.value,
                        })
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
                            secondLastName: checked
                              ? ""
                              : formData.secondLastName,
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
                </div>

                {/* Columna 2 */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        placeholder="Mínimo 8 caracteres"
                        title="La contraseña debe cumplir con los requisitos de seguridad"
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
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-xs text-blue-800 font-medium mb-2">
                        Requisitos de la contraseña:
                      </p>
                      <ul className="text-xs text-blue-700 space-y-1">
                        <li
                          className={
                            formData.password.length >= 8
                              ? "text-green-600 font-medium"
                              : ""
                          }
                        >
                          • Al menos 8 caracteres{" "}
                          {formData.password.length >= 8 && "✓"}
                        </li>
                        <li
                          className={
                            /[a-z]/.test(formData.password)
                              ? "text-green-600 font-medium"
                              : ""
                          }
                        >
                          • Una letra minúscula{" "}
                          {/[a-z]/.test(formData.password) && "✓"}
                        </li>
                        <li
                          className={
                            /[A-Z]/.test(formData.password)
                              ? "text-green-600 font-medium"
                              : ""
                          }
                        >
                          • Una letra mayúscula{" "}
                          {/[A-Z]/.test(formData.password) && "✓"}
                        </li>
                        <li
                          className={
                            /[0-9]/.test(formData.password)
                              ? "text-green-600 font-medium"
                              : ""
                          }
                        >
                          • Un número {/[0-9]/.test(formData.password) && "✓"}
                        </li>
                        <li
                          className={
                            /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
                              formData.password
                            )
                              ? "text-green-600 font-medium"
                              : ""
                          }
                        >
                          • Un carácter especial (!@#$%^&*...){" "}
                          {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
                            formData.password
                          ) && "✓"}
                        </li>
                      </ul>
                    </div>
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
                          <SelectItem value="none">
                            Sin clínica asignada
                          </SelectItem>
                          {clinics.map((clinic) => (
                            <SelectItem key={clinic.id} value={clinic.id}>
                              {clinic.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="doctor" className="space-y-4 mt-4">
              {formData.role === "DOCTOR" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="specialties">Especialidades *</Label>
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
                          // Si solo hay una especialidad seleccionada, hacerla principal automáticamente
                          primarySpecialtyId:
                            selected.length === 1
                              ? selected[0]
                              : formData.primarySpecialtyId &&
                                  selected.includes(formData.primarySpecialtyId)
                                ? formData.primarySpecialtyId
                                : "",
                        })
                      }
                      placeholder="Seleccionar especialidades..."
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Seleccione una o más especialidades médicas
                    </p>
                  </div>

                  {formData.specialtyIds.length > 1 && (
                    <div className="space-y-2">
                      <Label htmlFor="primarySpecialty">
                        Especialidad Principal *
                      </Label>
                      <Select
                        value={formData.primarySpecialtyId || ""}
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
                                {specialty?.name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        La especialidad principal aparecerá primero en los
                        listados
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
              {loading ? "Creando..." : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
