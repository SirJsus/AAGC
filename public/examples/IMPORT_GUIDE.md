# Guía de Importación de Datos - Simplificada

Esta guía describe cómo importar datos masivos a la clínica usando archivos CSV o JSON.

## Formatos Soportados

El sistema soporta dos formatos de archivo:

- **CSV**: Valores separados por comas
- **JSON**: Formato de objetos JavaScript

## Tipos de Importación

### 1. Importación de Pacientes

#### 🎯 Importación Simplificada

El sistema ha sido simplificado para facilitar la importación rápida de pacientes. Solo necesitas proporcionar los datos básicos y el sistema se encarga del resto.

#### Campos Requeridos

- `firstName` (string): Nombre del paciente
- `lastName` (string): Apellido paterno (se usará la 1ª letra para el ID)
- **ID en 3 partes (OBLIGATORIO):**
  - `customIdClinic` (string): Acrónimo de la clínica (ej: "ABC")
  - `customIdDoctor` (string): Acrónimo del doctor (ej: "DFG")
  - `customIdNumber` (number): Número consecutivo (ej: 1, 2, 3...)

**✨ Nota sobre la letra del apellido:**
El sistema extrae **automáticamente** la primera letra del `lastName` para construir el ID personalizado.

**Ejemplo:**

- Si importas: `lastName="Benítez"`, `customIdClinic="ABC"`, `customIdDoctor="DFG"`, `customIdNumber=1`
- Se generará el ID: **ABC-DFG-B001**

El número se formatea automáticamente con 3 dígitos (padding con ceros).

#### Campos Opcionales

- `secondLastName` (string): Apellido materno
- `noSecondLastName` (boolean): true si no tiene segundo apellido
- `phone` (string): Teléfono (se genera temporal si no se proporciona)
- `email` (string): Correo electrónico

#### Ejemplo CSV

```csv
firstName,lastName,secondLastName,noSecondLastName,customIdClinic,customIdDoctor,customIdNumber,phone,email
Juan,Pérez,García,false,ABC,DFG,1,555-0001,juan.perez@example.com
María,González,López,false,ABC,DFG,2,555-0002,maria.gonzalez@example.com
Pedro,Rodríguez,Martínez,false,ABC,DFG,3,555-0003,pedro.rodriguez@example.com
Ana,Fernández,,true,ABC,DFG,4,555-0004,ana.fernandez@example.com
Carlos,López,Sánchez,false,ABC,DFG,5,,
```

**IDs generados:**

- Fila 1: `ABC` + `DFG` + `P` (de Pérez) + `001` → **ABC-DFG-P001**
- Fila 2: `ABC` + `DFG` + `G` (de González) + `002` → **ABC-DFG-G002**
- Fila 3: `ABC` + `DFG` + `R` (de Rodríguez) + `003` → **ABC-DFG-R003**
- Fila 4: `ABC` + `DFG` + `F` (de Fernández) + `004` → **ABC-DFG-F004**
- Fila 5: `ABC` + `DFG` + `L` (de López) + `005` → **ABC-DFG-L005** (sin teléfono, se genera temporal)

#### Ejemplo JSON

```json
[
  {
    "firstName": "Juan",
    "lastName": "Pérez",
    "secondLastName": "García",
    "noSecondLastName": false,
    "customIdClinic": "ABC",
    "customIdDoctor": "DFG",
    "customIdNumber": 1,
    "phone": "555-0001",
    "email": "juan.perez@example.com"
  }
]
```

Ver archivos de ejemplo completos: `patients-import-example.csv` o `patients-import-example.json`

### 2. Importación de Doctores

#### Campos Requeridos

- `firstName` (string): Nombre del doctor
- `lastName` (string): Apellido del doctor
- `license` o `licenseNumber` (string): Número de licencia único

#### Campos Opcionales

- `secondLastName` (string): Apellido materno
- `noSecondLastName` (boolean): true si no tiene segundo apellido
- `specialty` (string): Especialidad médica
- `phone` (string): Teléfono de contacto
- `email` (string): Correo electrónico
- `address` (string): Dirección
- `dateOfBirth` o `birthDate` (string): Fecha de nacimiento (YYYY-MM-DD)
- `acronym` (string): Acrónimo para IDs de pacientes (se genera automáticamente si no se proporciona)
- `roomName` (string): Nombre del consultorio asignado
- `isActive` (boolean): Si el doctor está activo (default: true)

#### Ejemplo CSV

```csv
firstName,lastName,license,specialty,phone,email,acronym
Dr. Eduardo,Hernández,LIC12345,Cardiología,555-1001,eduardo.h@clinica.com,EH
Dra. María,López,LIC67890,Pediatría,555-1002,maria.l@clinica.com,ML
```

### 3. Importación de Citas

#### Campos Requeridos

- `patientCustomId` (string): ID personalizado del paciente
- `doctorLicense` (string): Licencia del doctor
- `date` (string): Fecha de la cita (YYYY-MM-DD)
- `startTime` (string): Hora de inicio (HH:MM)
- `endTime` (string): Hora de fin (HH:MM)

#### Campos Opcionales

- `appointmentTypeName` (string): Nombre del tipo de cita
- `roomName` (string): Nombre del consultorio
- `customReason` (string): Razón personalizada
- `customPrice` (number): Precio personalizado
- `status` (string): Estado (PENDING, CONFIRMED, IN_CONSULTATION, etc.)
- `paymentMethod` (string): Método de pago (CASH, DEBIT_CARD, CREDIT_CARD, TRANSFER)
- `paymentConfirmed` (boolean): Si el pago está confirmado
- `notes` (string): Notas adicionales

#### Ejemplo CSV

```csv
patientCustomId,doctorLicense,date,startTime,endTime,status
ABC-DFG-P001,LIC12345,2025-11-20,09:00,10:00,CONFIRMED
ABC-DFG-G002,LIC67890,2025-11-20,10:00,11:00,PENDING
```

## Consejos y Mejores Prácticas

1. **Prueba con pocos registros primero**: Importa 5-10 registros para verificar que el formato es correcto
2. **Mantén backups**: Guarda copias de tus archivos originales
3. **IDs únicos**: Asegúrate de que los IDs personalizados sean únicos
4. **Formato de fechas**: Usa siempre YYYY-MM-DD para las fechas
5. **Formato de horas**: Usa formato de 24 horas HH:MM

## 📝 Codificación de Archivos CSV

### Problema Común: Caracteres Especiales (ñ, á, é, í, ó, ú)

Si al importar un archivo CSV ves caracteres extraños como `?` en lugar de `ñ` o acentos, es un problema de codificación.

### ✅ Solución Automática

El sistema **detecta automáticamente** la codificación del archivo y la convierte correctamente. Verás un mensaje verde indicando la codificación detectada:

- **UTF-8**: La codificación estándar y recomendada
- **Windows-1252**: Común en archivos exportados desde Excel en Windows

### 📋 Cómo Guardar CSV desde Excel con la Codificación Correcta

#### Opción 1: CSV UTF-8 (Recomendado)

1. En Excel, ve a **Archivo > Guardar como**
2. En "Tipo", selecciona **CSV UTF-8 (delimitado por comas) (\*.csv)**
3. Guarda el archivo

#### Opción 2: CSV Estándar (también funciona)

1. En Excel, ve a **Archivo > Guardar como**
2. En "Tipo", selecciona **CSV (delimitado por comas) (\*.csv)**
3. Guarda el archivo
4. El sistema detectará automáticamente la codificación Windows-1252 y la convertirá

#### Opción 3: Desde Google Sheets

1. Abre tu hoja de cálculo en Google Sheets
2. Ve a **Archivo > Descargar > Valores separados por comas (.csv)**
3. Google Sheets exporta automáticamente en UTF-8

### 🔍 Verificar que los Caracteres se Importaron Correctamente

Después de importar:

1. Ve a la sección de Pacientes/Doctores
2. Verifica que los nombres con `ñ` y acentos se vean correctamente
3. Si ves `?` o caracteres raros, reporta el problema

### ⚠️ Qué NO Hacer

- **NO** edites archivos CSV en Bloc de notas sin especificar codificación UTF-8
- **NO** uses programas antiguos que no soporten UTF-8
- **NO** copies y pegues datos entre diferentes programas sin verificar la codificación

## Solución de Problemas

### Error: "Missing required fields"

- Verifica que todos los campos requeridos estén presentes
- Para pacientes: firstName, lastName, customIdClinic, customIdDoctor, customIdNumber

### Error: "Patient with customId XXX already exists"

- El ID personalizado debe ser único
- Verifica que no hayas importado ese paciente anteriormente
- Cambia el `customIdNumber` a uno que no esté en uso

### Error: "Clinic ID is required"

- Debes seleccionar una clínica antes de importar
- Si eres admin, selecciona la clínica en el formulario

## Contacto y Soporte

Si tienes problemas con la importación, contacta al equipo de soporte técnico.
