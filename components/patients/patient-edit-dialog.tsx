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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Patient, Doctor, Gender } from "@prisma/client";
import { updatePatient } from "@/lib/actions/patients";
import { getDoctors } from "@/lib/actions/doctors";
import { Hash } from "lucide-react";
import { calculateAge } from "@/lib/patient";

interface PatientEditDialogProps {
  patient: Patient;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  readOnly?: boolean;
}

export function PatientEditDialog({
  patient,
  trigger,
  onSuccess,
  readOnly = false,
}: PatientEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [doctors, setDoctors] = useState<
    Array<
      Doctor & {
        user: {
          firstName: string;
          lastName: string;
          secondLastName: string | null;
        };
      }
    >
  >([]);

  const [doctorType, setDoctorType] = useState<
    "internal" | "external" | "none"
  >(
    patient.doctorId
      ? "internal"
      : patient.primaryDoctorFirstName || patient.primaryDoctorLastName
        ? "external"
        : "none"
  );

  const [formData, setFormData] = useState({
    firstName: patient.firstName,
    lastName: patient.lastName,
    secondLastName: patient.secondLastName || "",
    noSecondLastName: patient.noSecondLastName || false,
    phone: patient.phone,
    email: patient.email || "",
    gender: patient.gender || ("OTHER" as Gender),
    birthDate: patient.birthDate
      ? new Date(patient.birthDate).toISOString().split("T")[0]
      : "",
    address: patient.address || "",
    emergencyContactFirstName: patient.emergencyContactFirstName || "",
    emergencyContactLastName: patient.emergencyContactLastName || "",
    emergencyContactSecondLastName:
      patient.emergencyContactSecondLastName || "",
    emergencyContactNoSecondLastName:
      patient.emergencyContactNoSecondLastName || false,
    emergencyContactPhone: patient.emergencyContactPhone || "",
    primaryDoctorFirstName: patient.primaryDoctorFirstName || "",
    primaryDoctorLastName: patient.primaryDoctorLastName || "",
    primaryDoctorSecondLastName: patient.primaryDoctorSecondLastName || "",
    primaryDoctorNoSecondLastName:
      patient.primaryDoctorNoSecondLastName || false,
    primaryDoctorPhone: patient.primaryDoctorPhone || "",
    notes: patient.notes || "",
    doctorId: patient.doctorId || "",
    customDoctorAcronym: patient.customDoctorAcronym || "",
  });

  // Edad calculada a partir de la fecha de nacimiento (formData.birthDate)
  const [age, setAge] = useState<number | null>(
    patient.birthDate
      ? calculateAge(new Date(patient.birthDate).toISOString().split("T")[0])
      : null
  );

  useEffect(() => {
    if (open) {
      loadDoctors();
    }
  }, [open]);

  // Re-calcular edad cuando cambie la fecha en el formulario
  useEffect(() => {
    setAge(formData.birthDate ? calculateAge(formData.birthDate) : null);
  }, [formData.birthDate]);

  const loadDoctors = async () => {
    try {
      const data = await getDoctors();
      setDoctors(data);
    } catch (error) {
      toast.error("Error al cargar doctores");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.phone) {
      toast.error("Por favor completa los campos requeridos");
      return;
    }

    if (!formData.noSecondLastName && !formData.secondLastName.trim()) {
      toast.error(
        "Por favor completa el Apellido Materno o marca la casilla si no tiene"
      );
      return;
    }

    setIsLoading(true);
    try {
      await updatePatient(patient.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        secondLastName: formData.secondLastName || undefined,
        noSecondLastName: formData.noSecondLastName,
        phone: formData.phone,
        email: formData.email || undefined,
        birthDate: formData.birthDate || undefined,
        gender: formData.gender,
        address: formData.address || undefined,
        emergencyContactFirstName:
          formData.emergencyContactFirstName || undefined,
        emergencyContactLastName:
          formData.emergencyContactLastName || undefined,
        emergencyContactSecondLastName:
          formData.emergencyContactSecondLastName || undefined,
        emergencyContactNoSecondLastName:
          formData.emergencyContactNoSecondLastName,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
        primaryDoctorFirstName:
          doctorType === "external"
            ? formData.primaryDoctorFirstName
            : undefined,
        primaryDoctorLastName:
          doctorType === "external"
            ? formData.primaryDoctorLastName
            : undefined,
        primaryDoctorSecondLastName:
          doctorType === "external"
            ? formData.primaryDoctorSecondLastName
            : undefined,
        primaryDoctorNoSecondLastName:
          doctorType === "external"
            ? formData.primaryDoctorNoSecondLastName
            : false,
        primaryDoctorPhone:
          doctorType === "external" ? formData.primaryDoctorPhone : undefined,
        notes: formData.notes || undefined,
        doctorId:
          doctorType === "internal" && formData.doctorId !== "none"
            ? formData.doctorId
            : undefined,
        customDoctorAcronym: formData.customDoctorAcronym || undefined,
      });
      toast.success("Paciente actualizado exitosamente");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al actualizar paciente"
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
        {trigger || <Button>Editar Paciente</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {readOnly
              ? "Visualizar Información del Paciente"
              : "Editar Información del Paciente"}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? "Revisa la información del paciente. Los campos están bloqueados para evitar cambios."
              : "Completa o actualiza la información del paciente"}
          </DialogDescription>
        </DialogHeader>

        {/* Display Patient ID */}
        <div className="rounded-lg border bg-muted/50 p-3 flex items-center gap-3">
          <Hash className="h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">
              ID del Paciente
            </Label>
            <Badge
              variant="outline"
              className="text-base font-mono px-2 py-0.5 mt-1"
            >
              {patient.customId}
            </Badge>
          </div>
          <div className="text-right">
            <Label className="text-xs text-muted-foreground">Edad</Label>
            <div className="text-base font-medium mt-1">
              {age !== null ? `${age} años` : "N/A"}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="personal">Datos Personales</TabsTrigger>
              <TabsTrigger value="doctor">Doctor</TabsTrigger>
              <TabsTrigger value="emergency">Emergencia</TabsTrigger>
              <TabsTrigger value="notes">Notas</TabsTrigger>
            </TabsList>
            <TabsContent value="personal" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    Nombre <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      !readOnly &&
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    placeholder="Nombre"
                    required
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    Apellido Paterno <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) =>
                      !readOnly &&
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    placeholder="Apellido Paterno"
                    required
                    disabled={readOnly}
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
                      !readOnly &&
                      setFormData({
                        ...formData,
                        secondLastName: e.target.value,
                      })
                    }
                    placeholder="Apellido Materno"
                    disabled={readOnly || formData.noSecondLastName}
                  />
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="noSecondLastName"
                      checked={formData.noSecondLastName}
                      onCheckedChange={(checked) => {
                        if (readOnly) return;
                        setFormData({
                          ...formData,
                          noSecondLastName: checked as boolean,
                          secondLastName: checked
                            ? ""
                            : formData.secondLastName,
                        });
                      }}
                      disabled={readOnly}
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
                  <Label htmlFor="phone">
                    Teléfono <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      !readOnly &&
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="Teléfono"
                    required
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      !readOnly &&
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="correo@ejemplo.com"
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Género</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) =>
                      !readOnly &&
                      setFormData({ ...formData, gender: value as Gender })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Masculino</SelectItem>
                      <SelectItem value="FEMALE">Femenino</SelectItem>
                      <SelectItem value="OTHER">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) =>
                      !readOnly &&
                      setFormData({ ...formData, birthDate: e.target.value })
                    }
                    disabled={readOnly}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    !readOnly &&
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Dirección completa"
                  disabled={readOnly}
                />
              </div>
            </TabsContent>
            <TabsContent value="doctor" className="space-y-4">
              <Separator className="my-4" />
              <h3 className="text-lg font-semibold">Doctor de Cabecera</h3>
              <p className="text-sm text-muted-foreground">
                Selecciona si el paciente tiene un doctor de cabecera
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="doctorType">Tipo de Doctor</Label>
                  <Select
                    value={doctorType}
                    onValueChange={(value) => {
                      if (readOnly) return;
                      setDoctorType(value as "internal" | "external" | "none");
                      if (value === "none") {
                        setFormData({
                          ...formData,
                          doctorId: "",
                          primaryDoctorFirstName: "",
                          primaryDoctorLastName: "",
                          primaryDoctorSecondLastName: "",
                          primaryDoctorNoSecondLastName: false,
                          primaryDoctorPhone: "",
                        });
                      } else if (value === "internal") {
                        setFormData({
                          ...formData,
                          primaryDoctorFirstName: "",
                          primaryDoctorLastName: "",
                          primaryDoctorSecondLastName: "",
                          primaryDoctorNoSecondLastName: false,
                          primaryDoctorPhone: "",
                        });
                      } else if (value === "external") {
                        setFormData({ ...formData, doctorId: "" });
                      }
                    }}
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        Sin doctor de cabecera
                      </SelectItem>
                      <SelectItem value="internal">
                        Doctor Interno (de la clínica)
                      </SelectItem>
                      <SelectItem value="external">Doctor Externo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {doctorType === "internal" && (
                  <div className="space-y-2">
                    <Label htmlFor="doctorId">Doctor de la Clínica</Label>
                    <Select
                      value={formData.doctorId}
                      onValueChange={(value) =>
                        !readOnly &&
                        setFormData({ ...formData, doctorId: value })
                      }
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          Selecciona un doctor
                        </SelectItem>
                        {doctors
                          .filter((d) => d.isActive)
                          .map((doctor) => (
                            <SelectItem key={doctor.id} value={doctor.id}>
                              Dr. {doctor.user.firstName} {doctor.user.lastName}
                              {doctor.user.secondLastName
                                ? ` ${doctor.user.secondLastName}`
                                : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {doctorType === "external" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primaryDoctorFirstName">Nombre</Label>
                      <Input
                        id="primaryDoctorFirstName"
                        value={formData.primaryDoctorFirstName}
                        onChange={(e) =>
                          !readOnly &&
                          setFormData({
                            ...formData,
                            primaryDoctorFirstName: e.target.value,
                          })
                        }
                        placeholder="Nombre"
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="primaryDoctorLastName">
                        Apellido Paterno
                      </Label>
                      <Input
                        id="primaryDoctorLastName"
                        value={formData.primaryDoctorLastName}
                        onChange={(e) =>
                          !readOnly &&
                          setFormData({
                            ...formData,
                            primaryDoctorLastName: e.target.value,
                          })
                        }
                        placeholder="Apellido Paterno"
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="primaryDoctorSecondLastName">
                        Apellido Materno
                      </Label>
                      <Input
                        id="primaryDoctorSecondLastName"
                        value={formData.primaryDoctorSecondLastName}
                        onChange={(e) =>
                          !readOnly &&
                          setFormData({
                            ...formData,
                            primaryDoctorSecondLastName: e.target.value,
                          })
                        }
                        placeholder="Apellido Materno"
                        disabled={
                          readOnly || formData.primaryDoctorNoSecondLastName
                        }
                      />
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="primaryDoctorNoSecondLastName"
                          checked={formData.primaryDoctorNoSecondLastName}
                          onCheckedChange={(checked) => {
                            if (readOnly) return;
                            setFormData({
                              ...formData,
                              primaryDoctorNoSecondLastName: checked as boolean,
                              primaryDoctorSecondLastName: checked
                                ? ""
                                : formData.primaryDoctorSecondLastName,
                            });
                          }}
                          disabled={readOnly}
                        />
                        <label
                          htmlFor="primaryDoctorNoSecondLastName"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          No tiene apellido materno
                        </label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="primaryDoctorPhone">
                        Teléfono del Doctor
                      </Label>
                      <Input
                        id="primaryDoctorPhone"
                        value={formData.primaryDoctorPhone}
                        onChange={(e) =>
                          !readOnly &&
                          setFormData({
                            ...formData,
                            primaryDoctorPhone: e.target.value,
                          })
                        }
                        placeholder="Teléfono"
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="emergency" className="space-y-4">
              <Separator className="my-4" />
              <h3 className="text-lg font-semibold">Contacto de Emergencia</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactFirstName">Nombre</Label>
                  <Input
                    id="emergencyContactFirstName"
                    value={formData.emergencyContactFirstName}
                    onChange={(e) =>
                      !readOnly &&
                      setFormData({
                        ...formData,
                        emergencyContactFirstName: e.target.value,
                      })
                    }
                    placeholder="Nombre"
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactLastName">
                    Apellido Paterno
                  </Label>
                  <Input
                    id="emergencyContactLastName"
                    value={formData.emergencyContactLastName}
                    onChange={(e) =>
                      !readOnly &&
                      setFormData({
                        ...formData,
                        emergencyContactLastName: e.target.value,
                      })
                    }
                    placeholder="Apellido Paterno"
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactSecondLastName">
                    Apellido Materno
                  </Label>
                  <Input
                    id="emergencyContactSecondLastName"
                    value={formData.emergencyContactSecondLastName}
                    onChange={(e) =>
                      !readOnly &&
                      setFormData({
                        ...formData,
                        emergencyContactSecondLastName: e.target.value,
                      })
                    }
                    placeholder="Apellido Materno"
                    disabled={
                      readOnly || formData.emergencyContactNoSecondLastName
                    }
                  />
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="emergencyContactNoSecondLastName"
                      checked={formData.emergencyContactNoSecondLastName}
                      onCheckedChange={(checked) => {
                        if (readOnly) return;
                        setFormData({
                          ...formData,
                          emergencyContactNoSecondLastName: checked as boolean,
                          emergencyContactSecondLastName: checked
                            ? ""
                            : formData.emergencyContactSecondLastName,
                        });
                      }}
                      disabled={readOnly}
                    />
                    <label
                      htmlFor="emergencyContactNoSecondLastName"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      No tiene apellido materno
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactPhone">Teléfono</Label>
                  <Input
                    id="emergencyContactPhone"
                    value={formData.emergencyContactPhone}
                    onChange={(e) =>
                      !readOnly &&
                      setFormData({
                        ...formData,
                        emergencyContactPhone: e.target.value,
                      })
                    }
                    placeholder="Teléfono"
                    disabled={readOnly}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="notes" className="space-y-4">
              <Separator className="my-4" />
              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    !readOnly &&
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Notas adicionales sobre el paciente..."
                  rows={3}
                  disabled={readOnly}
                />
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              {readOnly ? "Cerrar" : "Cancelar"}
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? "Guardando..." : "Guardar Cambios"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
