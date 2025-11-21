"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
import { TAX_REGIMES } from "@/lib/constants/tax-regimes";
import { Permissions } from "@/lib/permissions";
import { Hash, AlertCircle } from "lucide-react";
import { calculateAge } from "@/lib/patient";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "verified" | "duplicate" | "error"
  >("idle");
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

  // Parse customId into its three parts: {PatientAcronym}-{DoctorAcronym}-{Letter}{Number}
  const customIdParts = patient.customId?.split("-") || ["", "", ""];
  const [customIdPatient, setCustomIdPatient] = useState(
    customIdParts[0] || ""
  );
  const [customIdDoctor, setCustomIdDoctor] = useState(customIdParts[1] || "");
  const [customIdSequence, setCustomIdSequence] = useState(
    customIdParts[2] || ""
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
    // Billing fields
    billingIsSameAsPatient: patient.billingIsSameAsPatient ?? true,
    billingName: patient.billingName || "",
    billingRFC: patient.billingRFC || "",
    billingTaxRegime: patient.billingTaxRegime || "",
    billingPostalCode: patient.billingPostalCode || "",
    billingEmail: patient.billingEmail || "",
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

  // Helper function to capitalize names properly
  const capitalizeName = (name: string): string => {
    return name
      .trim()
      .split(/\s+/)
      .map((word) => {
        if (word.length === 0) return "";
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  };

  // Re-calcular edad cuando cambie la fecha en el formulario
  useEffect(() => {
    setAge(formData.birthDate ? calculateAge(formData.birthDate) : null);
  }, [formData.birthDate]);

  // Resetear estado de verificación cuando cambian los campos del customId
  useEffect(() => {
    if (verificationStatus !== "idle") {
      setVerificationStatus("idle");
    }
  }, [customIdPatient, customIdDoctor, customIdSequence]);

  const loadDoctors = async () => {
    try {
      const data = await getDoctors();
      setDoctors(data.doctors);
    } catch (error) {
      toast.error(
        "No se pudo cargar la lista de doctores. Por favor, intenta nuevamente."
      );
    }
  };

  const verifyCustomId = async () => {
    // Validar formato primero
    if (!customIdPatient?.trim()) {
      toast.error("Por favor ingresa la parte del paciente del ID");
      return;
    }
    if (!customIdDoctor?.trim()) {
      toast.error("Por favor ingresa la parte del doctor del ID");
      return;
    }
    if (!customIdSequence?.trim()) {
      toast.error("Por favor ingresa la secuencia del ID");
      return;
    }
    if (!/^[A-Z0-9]+$/.test(customIdPatient.toUpperCase())) {
      toast.error("La parte del paciente solo debe contener letras y números");
      return;
    }
    if (!/^[A-Z0-9]+$/.test(customIdDoctor.toUpperCase())) {
      toast.error("La parte del doctor solo debe contener letras y números");
      return;
    }
    if (!/^[A-Z][0-9]{3}$/.test(customIdSequence.toUpperCase())) {
      toast.error(
        "La secuencia debe tener el formato: una letra seguida de 3 dígitos (ej: A001)"
      );
      return;
    }

    const newCustomId = `${customIdPatient.toUpperCase()}-${customIdDoctor.toUpperCase()}-${customIdSequence.toUpperCase()}`;

    // Si el ID no ha cambiado, no hay necesidad de verificar
    if (newCustomId === patient.customId) {
      setVerificationStatus("verified");
      toast.success("Este es el ID actual del paciente");
      return;
    }

    setIsVerifying(true);
    setVerificationStatus("idle");

    try {
      const response = await fetch("/api/patients/verify-custom-id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customId: newCustomId,
          patientId: patient.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al verificar el ID");
      }

      if (data.available) {
        setVerificationStatus("verified");
        toast.success(`✓ El ID "${newCustomId}" está disponible`);
      } else {
        setVerificationStatus("duplicate");
        toast.error(`El ID "${newCustomId}" ya está en uso por otro paciente`);
      }
    } catch (error) {
      setVerificationStatus("error");
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo verificar el ID. Por favor, intenta nuevamente."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación del customId si el usuario tiene permisos para editarlo
    const canEditCustomId =
      session?.user && Permissions.canEditPatientCustomId(session.user);
    if (canEditCustomId) {
      if (!customIdPatient?.trim()) {
        toast.error("Por favor ingresa la parte del paciente del ID");
        return;
      }
      if (!customIdDoctor?.trim()) {
        toast.error("Por favor ingresa la parte del doctor del ID");
        return;
      }
      if (!customIdSequence?.trim()) {
        toast.error("Por favor ingresa la secuencia del ID");
        return;
      }
      // Validar formato de las partes del customId
      if (!/^[A-Z0-9]+$/.test(customIdPatient.toUpperCase())) {
        toast.error(
          "La parte del paciente solo debe contener letras y números"
        );
        return;
      }
      if (!/^[A-Z0-9]+$/.test(customIdDoctor.toUpperCase())) {
        toast.error("La parte del doctor solo debe contener letras y números");
        return;
      }
      if (!/^[A-Z][0-9]{3}$/.test(customIdSequence.toUpperCase())) {
        toast.error(
          "La secuencia debe tener el formato: una letra seguida de 3 dígitos (ej: A001)"
        );
        return;
      }

      // Verificar que el ID ha sido verificado si ha cambiado
      const newCustomId = `${customIdPatient.toUpperCase()}-${customIdDoctor.toUpperCase()}-${customIdSequence.toUpperCase()}`;
      if (
        newCustomId !== patient.customId &&
        verificationStatus !== "verified"
      ) {
        toast.error("Por favor verifica el ID personalizado antes de guardar");
        return;
      }
    }

    // Validación de campos requeridos básicos
    if (!formData.firstName?.trim()) {
      toast.error("Por favor ingresa el nombre del paciente");
      return;
    }

    if (!formData.lastName?.trim()) {
      toast.error("Por favor ingresa el apellido paterno del paciente");
      return;
    }

    if (!formData.noSecondLastName && !formData.secondLastName?.trim()) {
      toast.error(
        "Por favor ingresa el apellido materno o marca la casilla si el paciente no tiene"
      );
      return;
    }

    if (!formData.phone?.trim()) {
      toast.error("Por favor ingresa el número de teléfono del paciente");
      return;
    }

    // Validación de formato de teléfono (solo números y caracteres permitidos)
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(formData.phone)) {
      toast.error(
        "El número de teléfono solo debe contener números y los caracteres: + - ( ) espacios"
      );
      return;
    }

    // Validación de email si se proporciona
    if (formData.email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error("Por favor ingresa un correo electrónico válido");
        return;
      }
    }

    // Validación de fecha de nacimiento
    if (formData.birthDate) {
      const birthDate = new Date(formData.birthDate);
      const today = new Date();

      if (birthDate > today) {
        toast.error(
          "La fecha de nacimiento no puede ser posterior a la fecha actual"
        );
        return;
      }

      const age = today.getFullYear() - birthDate.getFullYear();
      if (age > 150) {
        toast.error(
          "La fecha de nacimiento ingresada no parece ser válida. Por favor verifica"
        );
        return;
      }
    }

    // Validación de doctor externo si está seleccionado
    if (doctorType === "external") {
      if (!formData.primaryDoctorFirstName?.trim()) {
        toast.error("Por favor ingresa el nombre del doctor externo");
        return;
      }
      if (!formData.primaryDoctorLastName?.trim()) {
        toast.error("Por favor ingresa el apellido paterno del doctor externo");
        return;
      }
      if (
        !formData.primaryDoctorNoSecondLastName &&
        !formData.primaryDoctorSecondLastName?.trim()
      ) {
        toast.error(
          "Por favor ingresa el apellido materno del doctor externo o marca la casilla si no tiene"
        );
        return;
      }
    }

    // Validación de doctor interno si está seleccionado
    if (
      doctorType === "internal" &&
      (!formData.doctorId || formData.doctorId === "none")
    ) {
      toast.error("Por favor selecciona un doctor de la clínica");
      return;
    }

    // Validación de teléfono de contacto de emergencia si se proporciona
    if (formData.emergencyContactPhone?.trim()) {
      if (!phoneRegex.test(formData.emergencyContactPhone)) {
        toast.error(
          "El teléfono de emergencia solo debe contener números y los caracteres: + - ( ) espacios"
        );
        return;
      }
    }

    // Validación de teléfono del doctor externo si se proporciona
    if (formData.primaryDoctorPhone?.trim()) {
      if (!phoneRegex.test(formData.primaryDoctorPhone)) {
        toast.error(
          "El teléfono del doctor solo debe contener números y los caracteres: + - ( ) espacios"
        );
        return;
      }
    }

    // Validación de longitud de campos
    if (formData.firstName.trim().length > 100) {
      toast.error(
        "El nombre del paciente es demasiado largo (máximo 100 caracteres)"
      );
      return;
    }

    if (formData.lastName.trim().length > 100) {
      toast.error(
        "El apellido paterno es demasiado largo (máximo 100 caracteres)"
      );
      return;
    }

    if (
      formData.secondLastName &&
      formData.secondLastName.trim().length > 100
    ) {
      toast.error(
        "El apellido materno es demasiado largo (máximo 100 caracteres)"
      );
      return;
    }

    if (formData.notes && formData.notes.trim().length > 1000) {
      toast.error("Las notas son demasiado largas (máximo 1000 caracteres)");
      return;
    }

    // Validación de campos de facturación
    if (!formData.billingIsSameAsPatient) {
      if (!formData.billingName?.trim()) {
        toast.error(
          "Por favor ingresa el nombre o razón social para facturación"
        );
        return;
      }
      if (formData.billingName.trim().length > 200) {
        toast.error(
          "El nombre de facturación es demasiado largo (máximo 200 caracteres)"
        );
        return;
      }
      if (!formData.billingEmail?.trim()) {
        toast.error("Por favor ingresa el correo electrónico para facturación");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.billingEmail)) {
        toast.error(
          "Por favor ingresa un correo electrónico válido para facturación"
        );
        return;
      }
    }

    if (formData.billingRFC?.trim()) {
      // Validación de RFC: 12 o 13 caracteres alfanuméricos
      const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
      if (!rfcRegex.test(formData.billingRFC.toUpperCase())) {
        toast.error(
          "El RFC no tiene un formato válido (debe ser de 12 o 13 caracteres)"
        );
        return;
      }
    }

    if (formData.billingPostalCode?.trim()) {
      // Validación de código postal: 5 dígitos
      const postalCodeRegex = /^\d{5}$/;
      if (!postalCodeRegex.test(formData.billingPostalCode)) {
        toast.error("El código postal debe ser de 5 dígitos");
        return;
      }
    }

    // Tax regime validation removed - now using select from predefined list

    setIsLoading(true);
    try {
      const updateData: any = {
        firstName: capitalizeName(formData.firstName),
        lastName: capitalizeName(formData.lastName),
        secondLastName: formData.secondLastName
          ? capitalizeName(formData.secondLastName)
          : undefined,
        noSecondLastName: formData.noSecondLastName,
        phone: formData.phone,
        email: formData.email || undefined,
        birthDate: formData.birthDate || undefined,
        gender: formData.gender,
        address: formData.address
          ? capitalizeName(formData.address)
          : undefined,
        emergencyContactFirstName: formData.emergencyContactFirstName
          ? capitalizeName(formData.emergencyContactFirstName)
          : undefined,
        emergencyContactLastName: formData.emergencyContactLastName
          ? capitalizeName(formData.emergencyContactLastName)
          : undefined,
        emergencyContactSecondLastName: formData.emergencyContactSecondLastName
          ? capitalizeName(formData.emergencyContactSecondLastName)
          : undefined,
        emergencyContactNoSecondLastName:
          formData.emergencyContactNoSecondLastName,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
        primaryDoctorFirstName:
          doctorType === "external" && formData.primaryDoctorFirstName
            ? capitalizeName(formData.primaryDoctorFirstName)
            : undefined,
        primaryDoctorLastName:
          doctorType === "external" && formData.primaryDoctorLastName
            ? capitalizeName(formData.primaryDoctorLastName)
            : undefined,
        primaryDoctorSecondLastName:
          doctorType === "external" && formData.primaryDoctorSecondLastName
            ? capitalizeName(formData.primaryDoctorSecondLastName)
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
        // Billing fields
        billingIsSameAsPatient: formData.billingIsSameAsPatient,
        billingName: formData.billingIsSameAsPatient
          ? undefined
          : formData.billingName || undefined,
        billingRFC: formData.billingRFC || undefined,
        billingTaxRegime: formData.billingTaxRegime || undefined,
        billingPostalCode: formData.billingPostalCode || undefined,
        billingEmail: formData.billingIsSameAsPatient
          ? undefined
          : formData.billingEmail || undefined,
      };

      // Add customId if user has permission to edit it
      if (canEditCustomId) {
        const newCustomId = `${customIdPatient.toUpperCase()}-${customIdDoctor.toUpperCase()}-${customIdSequence.toUpperCase()}`;
        updateData.customId = newCustomId;
      }

      await updatePatient(patient.id, updateData);
      toast.success("Los datos del paciente se guardaron correctamente");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la información del paciente. Por favor, verifica los datos e intenta nuevamente."
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

        {/* Display Patient ID - Simple View */}
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
            <TabsList
              className={`grid w-full mb-4 ${
                session?.user &&
                Permissions.canEditPatientCustomId(session.user) &&
                !readOnly
                  ? "grid-cols-6"
                  : "grid-cols-5"
              }`}
            >
              <TabsTrigger value="personal">Datos Personales</TabsTrigger>
              <TabsTrigger value="doctor">Doctor</TabsTrigger>
              <TabsTrigger value="emergency">Emergencia</TabsTrigger>
              <TabsTrigger value="billing">Facturación</TabsTrigger>
              <TabsTrigger value="notes">Notas</TabsTrigger>
              {session?.user &&
                Permissions.canEditPatientCustomId(session.user) &&
                !readOnly && (
                  <TabsTrigger value="customId">ID Personalizado</TabsTrigger>
                )}
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
            <TabsContent value="billing" className="space-y-4">
              <Separator className="my-4" />
              <h3 className="text-lg font-semibold">Datos de Facturación</h3>
              <p className="text-sm text-muted-foreground">
                Información necesaria para la emisión de facturas
              </p>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="billingIsSameAsPatient"
                    checked={formData.billingIsSameAsPatient}
                    onCheckedChange={(checked) => {
                      if (!readOnly) {
                        setFormData({
                          ...formData,
                          billingIsSameAsPatient: checked === true,
                          billingName:
                            checked === true ? "" : formData.billingName,
                          billingEmail:
                            checked === true ? "" : formData.billingEmail,
                        });
                      }
                    }}
                    disabled={readOnly}
                  />
                  <Label
                    htmlFor="billingIsSameAsPatient"
                    className="text-sm font-normal cursor-pointer"
                  >
                    La factura será a nombre del paciente
                  </Label>
                </div>
                {!formData.billingIsSameAsPatient && (
                  <div className="space-y-2">
                    <Label htmlFor="billingName">
                      Nombre o Razón Social
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Input
                      id="billingName"
                      value={formData.billingName}
                      onChange={(e) =>
                        !readOnly &&
                        setFormData({
                          ...formData,
                          billingName: e.target.value,
                        })
                      }
                      placeholder="Nombre completo o razón social"
                      disabled={readOnly}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billingRFC">
                      RFC
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Input
                      id="billingRFC"
                      value={formData.billingRFC}
                      onChange={(e) =>
                        !readOnly &&
                        setFormData({
                          ...formData,
                          billingRFC: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="XAXX010101000"
                      maxLength={13}
                      disabled={readOnly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billingPostalCode">
                      Código Postal
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Input
                      id="billingPostalCode"
                      value={formData.billingPostalCode}
                      onChange={(e) =>
                        !readOnly &&
                        setFormData({
                          ...formData,
                          billingPostalCode: e.target.value,
                        })
                      }
                      placeholder="12345"
                      maxLength={5}
                      disabled={readOnly}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billingTaxRegime">
                    Régimen Fiscal
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Select
                    value={formData.billingTaxRegime}
                    onValueChange={(value) =>
                      !readOnly &&
                      setFormData({
                        ...formData,
                        billingTaxRegime: value,
                      })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger id="billingTaxRegime">
                      <SelectValue placeholder="Selecciona un régimen fiscal" />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_REGIMES.map((regime) => (
                        <SelectItem key={regime.code} value={regime.code}>
                          {regime.code} - {regime.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!formData.billingIsSameAsPatient && (
                  <div className="space-y-2">
                    <Label htmlFor="billingEmail">
                      Correo Electrónico para Factura
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Input
                      id="billingEmail"
                      type="email"
                      value={formData.billingEmail}
                      onChange={(e) =>
                        !readOnly &&
                        setFormData({
                          ...formData,
                          billingEmail: e.target.value,
                        })
                      }
                      placeholder="correo@ejemplo.com"
                      disabled={readOnly}
                    />
                  </div>
                )}
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
            {session?.user &&
              Permissions.canEditPatientCustomId(session.user) &&
              !readOnly && (
                <TabsContent value="customId" className="space-y-4">
                  <Separator className="my-4" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Hash className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold">
                        ID Personalizado
                      </h3>
                    </div>
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Precaución
                    </Badge>
                  </div>
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Advertencia:</strong> Modificar el ID puede romper
                      la secuencia de identificadores. Manejo cuidadoso
                      requerido.
                    </AlertDescription>
                  </Alert>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="customIdPatient" className="text-xs">
                        Parte Paciente <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="customIdPatient"
                        value={customIdPatient}
                        onChange={(e) =>
                          setCustomIdPatient(e.target.value.toUpperCase())
                        }
                        placeholder="PAC"
                        className="font-mono"
                        maxLength={10}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customIdDoctor" className="text-xs">
                        Parte Doctor <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="customIdDoctor"
                        value={customIdDoctor}
                        onChange={(e) =>
                          setCustomIdDoctor(e.target.value.toUpperCase())
                        }
                        placeholder="DOC"
                        className="font-mono"
                        maxLength={10}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customIdSequence" className="text-xs">
                        Secuencia <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="customIdSequence"
                        value={customIdSequence}
                        onChange={(e) =>
                          setCustomIdSequence(e.target.value.toUpperCase())
                        }
                        placeholder="A001"
                        className="font-mono"
                        maxLength={4}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        Vista previa:
                      </span>
                      <Badge
                        variant="outline"
                        className={`font-mono text-base ${
                          verificationStatus === "verified"
                            ? "border-green-500 text-green-700 dark:text-green-400"
                            : verificationStatus === "duplicate"
                              ? "border-red-500 text-red-700 dark:text-red-400"
                              : verificationStatus === "error"
                                ? "border-orange-500 text-orange-700 dark:text-orange-400"
                                : ""
                        }`}
                      >
                        {verificationStatus === "verified" && "✓ "}
                        {verificationStatus === "duplicate" && "✗ "}
                        {customIdPatient || "PAC"}-{customIdDoctor || "DOC"}-
                        {customIdSequence || "A001"}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant={
                        verificationStatus === "verified"
                          ? "default"
                          : "secondary"
                      }
                      size="sm"
                      onClick={verifyCustomId}
                      disabled={isVerifying || isLoading}
                      className={`${
                        verificationStatus === "verified"
                          ? "bg-green-600 hover:bg-green-700"
                          : verificationStatus === "duplicate"
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : ""
                      }`}
                    >
                      {isVerifying ? (
                        <>
                          <span className="animate-pulse">Verificando...</span>
                        </>
                      ) : verificationStatus === "verified" ? (
                        "✓ Verificado"
                      ) : verificationStatus === "duplicate" ? (
                        "✗ En Uso"
                      ) : (
                        "Verificar ID"
                      )}
                    </Button>
                  </div>
                </TabsContent>
              )}
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
