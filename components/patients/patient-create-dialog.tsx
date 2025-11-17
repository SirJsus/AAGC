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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gender } from "@prisma/client";
import { createPatient, previewPatientId } from "@/lib/actions/patients";
import { getDoctors } from "@/lib/actions/doctors";
import {
  UserPlus,
  Upload,
  Hash,
  User,
  Stethoscope,
  Phone,
  FileText,
} from "lucide-react";

interface PatientCreateDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function PatientCreateDialog({
  trigger,
  onSuccess,
}: PatientCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorType, setDoctorType] = useState<
    "internal" | "external" | "none"
  >("none");
  const [doctorAcronymType, setDoctorAcronymType] = useState<
    "internal" | "custom"
  >("internal");
  const [previewId, setPreviewId] = useState<string>("");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    secondLastName: "",
    noSecondLastName: false,
    phone: "",
    email: "",
    gender: "OTHER" as Gender,
    birthDate: "",
    address: "",
    emergencyContactFirstName: "",
    emergencyContactLastName: "",
    emergencyContactSecondLastName: "",
    emergencyContactNoSecondLastName: false,
    emergencyContactPhone: "",
    primaryDoctorFirstName: "",
    primaryDoctorLastName: "",
    primaryDoctorSecondLastName: "",
    primaryDoctorNoSecondLastName: false,
    primaryDoctorPhone: "",
    notes: "",
    doctorId: "",
    customDoctorAcronym: "",
  });

  useEffect(() => {
    if (open) {
      loadDoctors();
    }
  }, [open]);

  // Update ID preview when relevant fields change
  useEffect(() => {
    const updatePreview = async () => {
      if (formData.firstName && formData.lastName) {
        try {
          const id = await previewPatientId({
            firstName: formData.firstName,
            lastName: formData.lastName,
            secondLastName: formData.secondLastName || undefined,
            doctorId:
              doctorAcronymType === "internal" && formData.doctorId !== "none"
                ? formData.doctorId
                : undefined,
            customDoctorAcronym:
              doctorAcronymType === "custom" && formData.customDoctorAcronym
                ? formData.customDoctorAcronym
                : undefined,
          });
          setPreviewId(id || "");
        } catch (error) {
          setPreviewId("");
        }
      } else {
        setPreviewId("");
      }
    };
    updatePreview();
  }, [
    formData.firstName,
    formData.lastName,
    formData.secondLastName,
    formData.doctorId,
    formData.customDoctorAcronym,
    doctorAcronymType,
  ]);

  const loadDoctors = async () => {
    try {
      const data = await getDoctors();
      setDoctors(data.doctors);
    } catch (error) {
      toast.error("Error al cargar doctores");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.phone) {
      toast.error(
        "Por favor completa los campos requeridos (Nombre, Apellido Paterno, Teléfono)"
      );
      return;
    }

    if (!formData.noSecondLastName && !formData.secondLastName.trim()) {
      toast.error(
        "Por favor completa el Apellido Materno o marca la casilla si no tiene"
      );
      return;
    }

    if (
      doctorAcronymType === "custom" &&
      formData.customDoctorAcronym.length !== 3
    ) {
      toast.error(
        "El acrónimo personalizado del doctor debe tener exactamente 3 letras"
      );
      return;
    }

    setIsLoading(true);
    try {
      await createPatient({
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
          doctorAcronymType === "internal" && formData.doctorId !== "none"
            ? formData.doctorId
            : undefined,
        customDoctorAcronym:
          doctorAcronymType === "custom" && formData.customDoctorAcronym
            ? formData.customDoctorAcronym
            : undefined,
      });
      toast.success("Paciente creado exitosamente");
      handleClose();
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al crear paciente"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setFormData({
        firstName: "",
        lastName: "",
        secondLastName: "",
        noSecondLastName: false,
        phone: "",
        email: "",
        gender: "OTHER",
        birthDate: "",
        address: "",
        emergencyContactFirstName: "",
        emergencyContactLastName: "",
        emergencyContactSecondLastName: "",
        emergencyContactNoSecondLastName: false,
        emergencyContactPhone: "",
        primaryDoctorFirstName: "",
        primaryDoctorLastName: "",
        primaryDoctorSecondLastName: "",
        primaryDoctorNoSecondLastName: false,
        primaryDoctorPhone: "",
        notes: "",
        doctorId: "",
        customDoctorAcronym: "",
      });
      setDoctorType("none");
      setDoctorAcronymType("internal");
      setPreviewId("");
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
            <UserPlus className="mr-2 h-4 w-4" />
            Crear Paciente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Paciente</DialogTitle>
          <DialogDescription>
            Crea un nuevo paciente manualmente o importa desde archivo
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">
              <UserPlus className="mr-2 h-4 w-4" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="mr-2 h-4 w-4" />
              Importar (CSV/JSON)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="personal">
                    <User className="mr-2 h-4 w-4" />
                    Datos Personales
                  </TabsTrigger>
                  <TabsTrigger value="doctor">
                    <Stethoscope className="mr-2 h-4 w-4" />
                    Doctor
                  </TabsTrigger>
                  <TabsTrigger value="emergency">
                    <Phone className="mr-2 h-4 w-4" />
                    Emergencia
                  </TabsTrigger>
                  <TabsTrigger value="notes">
                    <FileText className="mr-2 h-4 w-4" />
                    Notas
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="personal" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">
                        Nombre <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            firstName: e.target.value,
                          })
                        }
                        placeholder="Ej: María"
                        required
                        minLength={2}
                        title="Ingrese el nombre del paciente"
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
                          setFormData({ ...formData, lastName: e.target.value })
                        }
                        placeholder="Ej: López"
                        required
                        minLength={2}
                        title="Ingrese el apellido paterno del paciente"
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
                        placeholder="Ej: Rodríguez"
                        disabled={formData.noSecondLastName}
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
                      <Label htmlFor="phone">
                        Teléfono <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder="Ej: 5512345678"
                        required
                        pattern="[0-9]{10,15}"
                        title="Ingrese un número de teléfono válido (10-15 dígitos)"
                      />
                      <p className="text-xs text-muted-foreground">
                        10-15 dígitos sin espacios ni guiones
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="paciente@ejemplo.com"
                        title="Ingrese un correo electrónico válido"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gender">Género</Label>
                      <Select
                        value={formData.gender}
                        onValueChange={(value) =>
                          setFormData({ ...formData, gender: value as Gender })
                        }
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
                          setFormData({
                            ...formData,
                            birthDate: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder="Dirección completa"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="doctor" className="space-y-4 mt-4">
                  <Separator className="my-4" />
                  <h3 className="text-lg font-semibold">Doctor Responsable</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="doctorId">Seleccionar Doctor</Label>
                      <Select
                        value={formData.doctorId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, doctorId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un doctor" />
                        </SelectTrigger>
                        <SelectContent>
                          {doctors.length === 0 && (
                            <SelectItem value="none" disabled>
                              No hay doctores disponibles
                            </SelectItem>
                          )}
                          {doctors.map((doctor) => (
                            <SelectItem key={doctor.id} value={doctor.id}>
                              {doctor.fullName} ({doctor.acronym})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="doctorAcronymType">
                        Tipo de Acrónimo
                      </Label>
                      <Select
                        value={doctorAcronymType}
                        onValueChange={(value) =>
                          setDoctorAcronymType(value as "internal" | "custom")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="internal">Interno</SelectItem>
                          <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {doctorAcronymType === "custom" && (
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="customDoctorAcronym">
                          Acrónimo Personalizado
                        </Label>
                        <Input
                          id="customDoctorAcronym"
                          value={formData.customDoctorAcronym}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              customDoctorAcronym: e.target.value,
                            })
                          }
                          placeholder="Ej: ABC"
                          maxLength={3}
                          title="Ingrese un acrónimo personalizado de 3 letras"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primaryDoctorFirstName">
                      Nombre del Doctor de Cabecera
                    </Label>
                    <Input
                      id="primaryDoctorFirstName"
                      value={formData.primaryDoctorFirstName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          primaryDoctorFirstName: e.target.value,
                        })
                      }
                      placeholder="Nombre"
                      disabled={doctorType !== "external"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primaryDoctorLastName">
                      Apellido Paterno del Doctor de Cabecera
                    </Label>
                    <Input
                      id="primaryDoctorLastName"
                      value={formData.primaryDoctorLastName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          primaryDoctorLastName: e.target.value,
                        })
                      }
                      placeholder="Apellido Paterno"
                      disabled={doctorType !== "external"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primaryDoctorSecondLastName">
                      Apellido Materno del Doctor de Cabecera
                    </Label>
                    <Input
                      id="primaryDoctorSecondLastName"
                      value={formData.primaryDoctorSecondLastName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          primaryDoctorSecondLastName: e.target.value,
                        })
                      }
                      placeholder="Apellido Materno"
                      disabled={
                        doctorType !== "external" ||
                        formData.primaryDoctorNoSecondLastName
                      }
                    />
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="primaryDoctorNoSecondLastName"
                        checked={formData.primaryDoctorNoSecondLastName}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            primaryDoctorNoSecondLastName: checked as boolean,
                            primaryDoctorSecondLastName: checked
                              ? ""
                              : formData.primaryDoctorSecondLastName,
                          });
                        }}
                        disabled={doctorType !== "external"}
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
                      Teléfono del Doctor de Cabecera
                    </Label>
                    <Input
                      id="primaryDoctorPhone"
                      value={formData.primaryDoctorPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          primaryDoctorPhone: e.target.value,
                        })
                      }
                      placeholder="Teléfono"
                      disabled={doctorType !== "external"}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDoctorType(
                          doctorType === "external" ? "none" : "external"
                        );
                        setFormData({
                          ...formData,
                          primaryDoctorFirstName: "",
                          primaryDoctorLastName: "",
                          primaryDoctorSecondLastName: "",
                          primaryDoctorNoSecondLastName: false,
                          primaryDoctorPhone: "",
                        });
                      }}
                      className="flex-1"
                    >
                      {doctorType === "external"
                        ? "Eliminar Doctor de Cabecera"
                        : "Agregar Doctor de Cabecera"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="emergency" className="space-y-4 mt-4">
                  <Separator className="my-4" />
                  <h3 className="text-lg font-semibold">
                    Contacto de Emergencia
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactFirstName">Nombre</Label>
                      <Input
                        id="emergencyContactFirstName"
                        value={formData.emergencyContactFirstName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            emergencyContactFirstName: e.target.value,
                          })
                        }
                        placeholder="Nombre"
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
                          setFormData({
                            ...formData,
                            emergencyContactLastName: e.target.value,
                          })
                        }
                        placeholder="Apellido Paterno"
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
                          setFormData({
                            ...formData,
                            emergencyContactSecondLastName: e.target.value,
                          })
                        }
                        placeholder="Apellido Materno"
                        disabled={formData.emergencyContactNoSecondLastName}
                      />
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="emergencyContactNoSecondLastName"
                          checked={formData.emergencyContactNoSecondLastName}
                          onCheckedChange={(checked) => {
                            setFormData({
                              ...formData,
                              emergencyContactNoSecondLastName:
                                checked as boolean,
                              emergencyContactSecondLastName: checked
                                ? ""
                                : formData.emergencyContactSecondLastName,
                            });
                          }}
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
                          setFormData({
                            ...formData,
                            emergencyContactPhone: e.target.value,
                          })
                        }
                        placeholder="Teléfono"
                      />
                    </div>
                  </div>

                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder="Notas adicionales sobre el paciente..."
                      rows={3}
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
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? "Creando..." : "Crear Paciente"}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="notes" className="space-y-4 mt-4">
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder="Notas adicionales sobre el paciente..."
                      rows={3}
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
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? "Creando..." : "Crear Paciente"}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </form>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <div className="text-center py-8">
              <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Importar Pacientes</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Para importar pacientes, utiliza la página de importación
                dedicada
              </p>
              <Button
                onClick={() => {
                  handleClose();
                  window.location.href = "/import";
                }}
              >
                Ir a Importación
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
