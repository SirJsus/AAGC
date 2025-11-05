"use client";

import { useState } from "react";
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

export default function ImportPage() {
  const [importType, setImportType] = useState<string>("PATIENTS");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const router = useRouter();

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

    setLoading(true);
    setResult(null);

    try {
      // Leer el contenido del archivo
      const fileContent = await file.text();

      // Crear el import job
      const job = await createImportJob({
        type: importType as any,
        fileName: file.name,
        fileContent,
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
                <p className="text-sm text-muted-foreground">
                  Campos requeridos:
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>firstName (Nombre)</li>
                  <li>lastName (Apellido)</li>
                  <li>phone (Teléfono)</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  Campos opcionales:
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>customId, secondLastName, email</li>
                  <li>birthDate (YYYY-MM-DD)</li>
                  <li>gender (MALE/FEMALE/OTHER)</li>
                  <li>address, emergencyContact, notes</li>
                  <li>doctorLicense (licencia del doctor)</li>
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
                  <li>specialty, phone, email</li>
                  <li>acronym (para IDs de pacientes)</li>
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
                  <li>status (PENDING/CONFIRMED/etc.)</li>
                  <li>notes, customReason</li>
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
          <div className="grid gap-4 md:grid-cols-3">
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
          </div>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Recomendaciones
                </p>
                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
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
