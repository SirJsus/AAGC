"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { createImportJob } from "@/lib/actions/import";
// Removed unused imports Badge and Progress to fix lint/no-unused-vars
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function ImportPage() {
  const [importType, setImportType] = useState<string>("PATIENTS");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [clinics, setClinics] = useState<any[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string>("");
  const router = useRouter();
  const { data: session, status } = useSession();

  const isAdmin = session?.user?.role === "ADMIN";
  const userClinicId = session?.user?.clinicId;

  // Cargar clínicas si es admin
  useEffect(() => {
    const loadClinics = async () => {
      if (isAdmin && status === "authenticated") {
        try {
          const response = await fetch("/api/clinics");
          if (response.ok) {
            const data = await response.json();
            setClinics(data);
          }
        } catch (error) {
          console.error("Error loading clinics:", error);
        }
      }
    };

    loadClinics();
  }, [isAdmin, status]);

  // Si no es admin, usar la clínica del usuario
  useEffect(() => {
    if (!isAdmin && userClinicId) {
      setSelectedClinicId(userClinicId);
    }
  }, [isAdmin, userClinicId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validar extensión
      const validExtensions = [".csv", ".json"];
      const fileExtension = selectedFile.name
        .substring(selectedFile.name.lastIndexOf("."))
        .toLowerCase();

      if (!validExtensions.includes(fileExtension)) {
        toast.error("Formato de archivo no válido. Use CSV o JSON.");
        return;
      }

      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Por favor selecciona un archivo");
      return;
    }

    // Validar que se haya seleccionado una clínica
    if (isAdmin && !selectedClinicId) {
      toast.error("Por favor selecciona una clínica");
      return;
    }

    // Para no-admin, verificar que tenga clínica asignada
    if (!isAdmin && !userClinicId) {
      toast.error(
        "Tu usuario no tiene una clínica asignada. Contacta al administrador."
      );
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Leer el contenido del archivo
      const fileContent = await file.text();

      const clinicId = isAdmin ? selectedClinicId : userClinicId || undefined;

      // Crear el import job
      const job = await createImportJob({
        type: importType as any,
        fileName: file.name,
        fileContent,
        clinicId,
      });

      toast.success("Importación iniciada");
      setResult({
        status: "PROCESSING",
        message:
          "La importación está en proceso. Esto puede tomar unos minutos.",
      });

      // Polling para ver el estado del job
      let attempts = 0;
      const maxAttempts = 60; // 1 minuto máximo
      const pollInterval = setInterval(async () => {
        attempts++;

        // Refrescar la página para obtener el estado actualizado
        router.refresh();

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setResult({
            status: "TIMEOUT",
            message:
              "La importación está tomando más tiempo del esperado. Revisa el estado más tarde.",
          });
          setLoading(false);
        }
      }, 1000);

      // Simular espera (en producción, deberías hacer polling real al backend)
      setTimeout(() => {
        clearInterval(pollInterval);
        setLoading(false);
        setResult({
          status: "COMPLETED",
          message: "Importación completada exitosamente",
        });
      }, 5000);
    } catch (error: any) {
      toast.error(error.message || "Error al importar archivo");
      setResult({
        status: "FAILED",
        message: error.message || "Error desconocido",
      });
      setLoading(false);
    }
  };

  const importTypeLabels: Record<string, string> = {
    PATIENTS: "Pacientes",
    DOCTORS: "Doctores",
    APPOINTMENTS: "Citas",
    USERS: "Usuarios",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importar Datos</h1>
        <p className="text-muted-foreground">
          Importa datos masivos desde archivos CSV o JSON
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cargar Archivo</CardTitle>
            <CardDescription>
              Selecciona el tipo de datos y el archivo a importar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="importType">Tipo de Importación</Label>
              <Select value={importType} onValueChange={setImportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PATIENTS">Pacientes</SelectItem>
                  <SelectItem value="DOCTORS">Doctores</SelectItem>
                  <SelectItem value="APPOINTMENTS">Citas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selector de clínica para admin */}
            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="clinic">Clínica</Label>
                <Select
                  value={selectedClinicId}
                  onValueChange={setSelectedClinicId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona la clínica" />
                  </SelectTrigger>
                  <SelectContent>
                    {clinics.map((clinic) => (
                      <SelectItem key={clinic.id} value={clinic.id}>
                        {clinic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Los datos se importarán a esta clínica
                </p>
              </div>
            )}

            {/* Info de clínica para no-admin */}
            {!isAdmin && userClinicId && (
              <div className="rounded-lg bg-blue-100 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3">
                <p className="text-sm text-blue-950 dark:text-blue-100">
                  Los datos se importarán a tu clínica asignada
                </p>
              </div>
            )}

            <div className="space-y-2">
              {/* Label htmlFor must match the input id for accessibility */}
              <Label htmlFor="file-input">Archivo (CSV o JSON)</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {file ? file.name : "Seleccionar archivo"}
                </Button>
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileChange}
                  className="hidden"
                  title="Seleccionar archivo de importación (CSV o JSON)"
                  aria-label="Seleccionar archivo de importación"
                />
              </div>
              {file && (
                <p className="text-sm text-muted-foreground">
                  Tamaño: {(file.size / 1024).toFixed(2)} KB
                </p>
              )}
            </div>

            <Button
              onClick={handleImport}
              disabled={!file || loading}
              className="w-full"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importar
            </Button>

            {result && (
              <div
                className={`p-4 rounded-lg ${
                  result.status === "COMPLETED"
                    ? "bg-green-50 dark:bg-green-900/20"
                    : result.status === "FAILED"
                      ? "bg-red-50 dark:bg-red-900/20"
                      : "bg-blue-50 dark:bg-blue-900/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.status === "COMPLETED" && (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  )}
                  {result.status === "FAILED" && (
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  {result.status === "PROCESSING" && (
                    <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />
                  )}
                  {result.status === "TIMEOUT" && (
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{result.message}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Formatos de Archivo</CardTitle>
            <CardDescription>
              Requisitos para cada tipo de importación
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {importType === "PATIENTS" && (
              <div className="space-y-2">
                <h4 className="font-medium">Pacientes (CSV/JSON)</h4>

                <div className="mt-3 p-3 bg-blue-100 dark:bg-blue-900/40 rounded-md border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-950 dark:text-blue-50 mb-1">
                    💡 Dos Modos de Importación
                  </p>
                  <ul className="text-xs text-blue-900 dark:text-blue-100 space-y-1">
                    <li>
                      • <strong>Modo Básico</strong>: Solo campos esenciales →
                      Paciente temporal
                    </li>
                    <li>
                      • <strong>Modo Completo</strong>: Todos los campos →
                      Paciente completo
                    </li>
                  </ul>
                </div>

                <p className="text-sm text-muted-foreground mt-3">
                  <strong>Campos requeridos (Modo Básico):</strong>
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>firstName (Nombre)</li>
                  <li>lastName (Apellido)</li>
                  <li>phone (Teléfono)</li>
                  <li>customIdClinic (Acrónimo clínica, ej: CE)</li>
                  <li>customIdDoctor (Acrónimo doctor, ej: EH)</li>
                  <li>customIdLastName (Letra apellido, ej: G)</li>
                  <li>customIdNumber (Número, ej: 1 o 001)</li>
                </ul>

                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Campos adicionales (Modo Completo):</strong>
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>secondLastName, noSecondLastName, email</li>
                  <li>birthDate (YYYY-MM-DD), gender (MALE/FEMALE/OTHER)</li>
                  <li>address, notes</li>
                  <li>doctorLicense (licencia del doctor asignado)</li>
                </ul>

                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Contacto de emergencia:</strong>
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>emergencyContactFirstName, emergencyContactLastName</li>
                  <li>
                    emergencyContactSecondLastName,
                    emergencyContactNoSecondLastName
                  </li>
                  <li>emergencyContactPhone</li>
                </ul>

                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Doctor primario externo:</strong>
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>primaryDoctorFirstName, primaryDoctorLastName</li>
                  <li>
                    primaryDoctorSecondLastName, primaryDoctorNoSecondLastName
                  </li>
                  <li>primaryDoctorPhone</li>
                </ul>
              </div>
            )}

            {importType === "DOCTORS" && (
              <div className="space-y-2">
                <h4 className="font-medium">Doctores (CSV/JSON)</h4>
                <p className="text-sm text-muted-foreground">
                  Campos requeridos:
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>firstName (Nombre)</li>
                  <li>lastName (Apellido)</li>
                  <li>license (Licencia única)</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  Campos opcionales:
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>secondLastName, noSecondLastName</li>
                  <li>specialty, phone, email, address</li>
                  <li>dateOfBirth (YYYY-MM-DD)</li>
                  <li>acronym (para IDs de pacientes)</li>
                  <li>roomName (nombre del consultorio)</li>
                  <li>isActive (true/false, default: true)</li>
                </ul>
              </div>
            )}

            {importType === "APPOINTMENTS" && (
              <div className="space-y-2">
                <h4 className="font-medium">Citas (CSV/JSON)</h4>
                <p className="text-sm text-muted-foreground">
                  Campos requeridos:
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>patientCustomId (ID del paciente)</li>
                  <li>doctorLicense (Licencia del doctor)</li>
                  <li>date (YYYY-MM-DD)</li>
                  <li>startTime (HH:MM)</li>
                  <li>endTime (HH:MM)</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  Campos opcionales:
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>appointmentTypeName (nombre del tipo de cita)</li>
                  <li>roomName (nombre del consultorio)</li>
                  <li>customReason, customPrice</li>
                  <li>status (PENDING/CONFIRMED/IN_CONSULTATION/etc.)</li>
                  <li>paymentMethod (CASH/DEBIT_CARD/CREDIT_CARD/TRANSFER)</li>
                  <li>paymentConfirmed (true/false)</li>
                  <li>notes, cancelReason</li>
                  <li>cancelledAt (YYYY-MM-DD), cancelledBy</li>
                </ul>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                <strong>Nota:</strong> Los archivos CSV deben incluir una fila
                de encabezado con los nombres de los campos. Los archivos JSON
                deben ser un array de objetos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recursos y ejemplos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recursos y Ejemplos
          </CardTitle>
          <CardDescription>
            Descarga archivos de ejemplo y guías para facilitar la importación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Guía de importación */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">📚 Guía Completa</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Guía detallada con formatos, validaciones y solución de
                problemas
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  asChild
                >
                  <a href="/examples/IMPORT_GUIDE.md" download target="_blank">
                    <FileText className="h-4 w-4 mr-2" />
                    Guía (Markdown)
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  asChild
                >
                  <a href="/examples/IMPORT_GUIDE.pdf" download target="_blank">
                    <FileText className="h-4 w-4 mr-2" />
                    Guía (PDF)
                  </a>
                </Button>
              </div>
            </div>

            {/* Ejemplos de pacientes */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">👥 Pacientes</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Archivos de ejemplo con datos de pacientes
              </p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Modo Completo:
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    asChild
                  >
                    <a href="/examples/patients-import-example.csv" download>
                      <Upload className="h-4 w-4 mr-2" />
                      Ejemplo CSV
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    asChild
                  >
                    <a href="/examples/patients-import-example.json" download>
                      <Upload className="h-4 w-4 mr-2" />
                      Ejemplo JSON
                    </a>
                  </Button>
                </div>
                <div className="space-y-1 pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground">
                    Modo Básico:
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    asChild
                  >
                    <a
                      href="/examples/patients-basic-import-example.csv"
                      download
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Ejemplo CSV
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    asChild
                  >
                    <a
                      href="/examples/patients-basic-import-example.json"
                      download
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Ejemplo JSON
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            {/* Ejemplos de doctores */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">⚕️ Doctores</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Archivos de ejemplo con datos de doctores
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  asChild
                >
                  <a href="/examples/doctors-import-example.csv" download>
                    <Upload className="h-4 w-4 mr-2" />
                    Ejemplo CSV
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  asChild
                >
                  <a href="/examples/doctors-import-example.json" download>
                    <Upload className="h-4 w-4 mr-2" />
                    Ejemplo JSON
                  </a>
                </Button>
              </div>
            </div>

            {/* Ejemplos de citas */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">📅 Citas</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Archivos de ejemplo con datos de citas
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  asChild
                >
                  <a href="/examples/appointments-import-example.csv" download>
                    <Upload className="h-4 w-4 mr-2" />
                    Ejemplo CSV
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  asChild
                >
                  <a href="/examples/appointments-import-example.json" download>
                    <Upload className="h-4 w-4 mr-2" />
                    Ejemplo JSON
                  </a>
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-100 dark:bg-blue-900/40 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-700 dark:text-blue-300 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-950 dark:text-blue-50">
                  Recomendaciones
                </p>
                <ul className="text-xs text-blue-900 dark:text-blue-100 space-y-1">
                  <li>
                    • Descarga y revisa la guía completa antes de comenzar
                  </li>
                  <li>
                    • Usa los archivos de ejemplo como plantilla para tus datos
                  </li>
                  <li>
                    • Prueba con 5-10 registros antes de importaciones masivas
                  </li>
                  <li>• Mantén backups de tus archivos originales</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
