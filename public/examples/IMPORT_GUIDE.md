# Guía de Importación de Datos

Esta guía describe cómo importar datos masivos a la clínica usando archivos CSV o JSON.

## Formatos Soportados

El sistema soporta dos formatos de archivo:

- **CSV**: Valores separados por comas
- **JSON**: Formato de objetos JavaScript

## Tipos de Importación

### 1. Importación de Pacientes

#### 🎯 Dos Modos de Importación

El sistema soporta dos modos de importación de pacientes:

**Modo Básico (Paciente Temporal)**

- Solo requiere campos esenciales
- Se marca como `pendingCompletion: true`
- Ideal para registro rápido en recepción
- Se puede completar información después

**Modo Completo (Paciente Completo)**

- Incluye todos los campos disponibles
- Se marca como `pendingCompletion: false`
- Información completa desde el inicio

#### Campos Requeridos (Modo Básico)

- `firstName` (string): Nombre del paciente
- `lastName` (string): Apellido paterno
- `phone` (string): Teléfono de contacto
- **ID en 4 partes (OBLIGATORIO):**
  - `customIdClinic` (string): Acrónimo de la clínica (ej: "CE")
  - `customIdDoctor` (string): Acrónimo del doctor (ej: "EH")
  - `customIdLastName` (string): Primera letra del apellido (ej: "G")
  - `customIdNumber` (string/number): Número correlativo (ej: "1" o "0001")
  - El sistema los juntará automáticamente: `{customIdClinic}{customIdDoctor}{customIdLastName}{customIdNumber}`

#### Campos Opcionales (Modo Completo)

**Datos Básicos del Paciente:**

- `secondLastName` (string): Apellido materno
- `noSecondLastName` (boolean): true si no tiene segundo apellido
- `email` (string): Correo electrónico
- `birthDate` (string): Fecha de nacimiento en formato YYYY-MM-DD
- `gender` (string): Género (MALE, FEMALE, OTHER)
- `address` (string): Dirección completa
- `notes` (string): Notas adicionales
- `doctorLicense` (string): Licencia del doctor asignado en la clínica
- `pendingCompletion` (boolean): true para marcar como temporal

**Contacto de Emergencia (Estructurado):**

- `emergencyContactFirstName` (string): Nombre del contacto
- `emergencyContactLastName` (string): Apellido del contacto
- `emergencyContactSecondLastName` (string): Segundo apellido
- `emergencyContactNoSecondLastName` (boolean): true si no tiene segundo apellido
- `emergencyContactPhone` (string): Teléfono del contacto

**Doctor Primario Externo (No de la clínica):**

- `primaryDoctorFirstName` (string): Nombre del doctor
- `primaryDoctorLastName` (string): Apellido del doctor
- `primaryDoctorSecondLastName` (string): Segundo apellido
- `primaryDoctorNoSecondLastName` (boolean): true si no tiene segundo apellido
- `primaryDoctorPhone` (string): Teléfono del doctor

#### Ejemplo CSV

```csv
firstName,lastName,phone,customIdClinic,customIdDoctor,customIdLastName,customIdNumber,pendingCompletion
Juan,García,+52 55 1234 5678,CE,EH,G,1,false
María,López,+52 55 2345 6789,CE,ML,L,2,false
Carlos,Hernández,+52 55 3456 7890,CE,EH,H,3,false
Pedro,Ramírez,+52 55 9999 0000,CE,RS,R,4,true
```

**Nota sobre el ID (customId):**

- **Fila 1**: `CE` + `EH` + `G` + `1` → se genera como **"CEEHG0001"**
- **Fila 2**: `CE` + `ML` + `L` + `2` → se genera como **"CEMLL0002"**
- **Fila 3**: `CE` + `EH` + `H` + `3` → se genera como **"CEEHH0003"**
- **Fila 4**: `CE` + `RS` + `R` + `4` → se genera como **"CERSR0004"** (temporal)
- El número se formatea automáticamente con 4 dígitos (padding con ceros)

Ver archivo de ejemplo completo: `patients-import-example.csv` o `patients-import-example.json`

### 2. Importación de Doctores

#### Campos Requeridos

- `firstName` (string): Nombre del doctor
- `lastName` (string): Apellido del doctor
- `license` (string): Número de cédula profesional (debe ser único)

#### Campos Opcionales

- `secondLastName` (string): Apellido materno
- `noSecondLastName` (boolean): true si no tiene segundo apellido
- `specialty` (string): Especialidad médica
- `phone` (string): Teléfono de contacto
- `email` (string): Correo electrónico
- `address` (string): Dirección
- `dateOfBirth` (string): Fecha de nacimiento en formato YYYY-MM-DD
- `acronym` (string): Acrónimo para IDs de pacientes (2-3 letras, default: primeras letras del nombre)
- `roomName` (string): Nombre del consultorio asignado
- `isActive` (boolean): Estado activo (default: true)

#### Ejemplo CSV

```csv
firstName,lastName,secondLastName,noSecondLastName,license,specialty,phone,email,dateOfBirth,acronym,roomName,isActive
Eduardo,Hernández,Ruiz,false,MED-001-CDM,Cardiología,+52 55 2345 6789,eduardo.hernandez@email.com,1975-03-15,EHR,Consultorio A,true
María,López,,true,MED-002-CDM,Pediatría,+52 55 3456 7890,maria.lopez@email.com,1980-07-22,ML,,true
```

Ver archivo de ejemplo completo: `doctors-import-example.csv` o `doctors-import-example.json`

### 3. Importación de Citas

#### Campos Requeridos

- `patientCustomId` (string): ID del paciente (ej: CEH0001)
- `doctorLicense` (string): Cédula del doctor
- `date` (string): Fecha de la cita en formato YYYY-MM-DD
- `startTime` (string): Hora de inicio en formato HH:MM
- `endTime` (string): Hora de fin en formato HH:MM

#### Campos Opcionales

- `appointmentTypeName` (string): Nombre del tipo de cita
- `roomName` (string): Nombre del consultorio
- `customReason` (string): Motivo personalizado
- `customPrice` (number): Precio personalizado
- `status` (string): Estado (PENDING, CONFIRMED, IN_CONSULTATION, TRANSFER_PENDING, COMPLETED, CANCELLED, PAID, NO_SHOW, REQUIRES_RESCHEDULE)
- `paymentMethod` (string): Método de pago (CASH, DEBIT_CARD, CREDIT_CARD, TRANSFER)
- `paymentConfirmed` (boolean): Si el pago fue confirmado
- `notes` (string): Notas adicionales
- `cancelReason` (string): Razón de cancelación
- `cancelledAt` (string): Fecha de cancelación en formato YYYY-MM-DD
- `cancelledBy` (string): Quien canceló

#### Ejemplo CSV

```csv
patientCustomId,doctorLicense,date,startTime,endTime,appointmentTypeName,roomName,customPrice,status,paymentMethod,paymentConfirmed,notes
CEH0001,MED-001-CDM,2025-11-10,09:00,09:30,Consulta General,Consultorio A,500,CONFIRMED,CASH,true,Primera consulta
CEH0002,MED-002-CDM,2025-11-10,10:00,10:45,Consulta Especializada,Consultorio B,800,PENDING,,,Evaluación
```

Ver archivo de ejemplo completo: `appointments-import-example.csv` o `appointments-import-example.json`

## Reglas de Validación

### Formatos de Datos

1. **Fechas**: Usar formato ISO 8601 (YYYY-MM-DD)
   - Ejemplo: `2024-12-25`

2. **Horas**: Usar formato de 24 horas (HH:MM)
   - Ejemplo: `14:30`

3. **Teléfonos**: Incluir código de país (recomendado)
   - Ejemplo: `+52 55 1234 5678`

4. **Género**: Usar valores exactos
   - Válidos: `MALE`, `FEMALE`, `OTHER`

5. **Estado de Citas**: Usar valores exactos
   - Válidos: `PENDING`, `CONFIRMED`, `IN_CONSULTATION`, `TRANSFER_PENDING`, `COMPLETED`, `CANCELLED`, `PAID`, `NO_SHOW`, `REQUIRES_RESCHEDULE`

6. **Métodos de Pago**: Usar valores exactos
   - Válidos: `CASH`, `DEBIT_CARD`, `CREDIT_CARD`, `TRANSFER`

7. **Booleanos**: Usar valores exactos
   - Válidos: `true`, `false` (en minúsculas)

### Consideraciones Importantes

1. **Unicidad**
   - Cédulas de doctores deben ser únicas
   - Emails de usuarios deben ser únicos
   - No puede haber dos citas para el mismo doctor a la misma hora
   - No puede haber dos citas en la misma sala a la misma hora

2. **Referencias**
   - Al importar citas, los pacientes y doctores referenciados deben existir previamente
   - Los tipos de cita y salas se buscan por nombre (opcional)
   - Si no se encuentra un tipo de cita o sala, la cita se crea sin esa relación

3. **Codificación**
   - Los archivos CSV deben usar codificación UTF-8
   - Usar comillas dobles para campos con comas o saltos de línea

4. **Límites**
   - Máximo 1000 registros por archivo recomendado
   - Tamaño máximo de archivo: 5 MB

## Proceso de Importación

1. **Preparar el archivo**
   - Descargar el archivo de ejemplo correspondiente
   - Completar con sus datos siguiendo el formato
   - Verificar que todos los campos requeridos estén presentes

2. **Subir el archivo**
   - Ir a la sección "Importar Datos" en el menú
   - Seleccionar el tipo de importación
   - Subir el archivo (CSV o JSON)

3. **Validación**
   - El sistema validará los datos automáticamente
   - Se mostrarán los errores encontrados si los hay
   - Corregir los errores y volver a intentar

4. **Confirmación**
   - Revisar el resumen de registros a importar
   - Confirmar la importación
   - Esperar a que el proceso termine

5. **Resultados**
   - Se mostrará un resumen con:
     - Registros exitosos
     - Registros con errores
     - Detalles de cada error

## Solución de Problemas

### Errores Comunes

1. **"Invalid date format"**
   - Verificar que las fechas estén en formato YYYY-MM-DD

2. **"Doctor not found"**
   - Verificar que la cédula del doctor exista en el sistema

3. **"Email already exists"**
   - El email ya está registrado, usar otro diferente

4. **"Doctor has appointment conflict"**
   - Ya existe una cita a esa hora para ese doctor

5. **"Room has appointment conflict"**
   - Ya existe una cita a esa hora en esa sala

6. **"Patient with customId XXX already exists"**
   - El ID de paciente ya existe, usar otro o no proporcionar customId

7. **"Invalid gender / status / paymentMethod"**
   - Verificar que se usen los valores exactos mencionados arriba

## Recomendaciones

1. **Hacer pruebas pequeñas primero**
   - Importar 5-10 registros inicialmente
   - Verificar que todo funcione correctamente
   - Luego proceder con importaciones más grandes

2. **Mantener backups**
   - Guardar copias de los archivos originales
   - Exportar datos antes de importaciones masivas

3. **Validar datos previamente**
   - Verificar formatos antes de subir
   - Eliminar registros duplicados
   - Completar campos requeridos

4. **Importar en orden**
   - Primero: Doctores (crea usuarios automáticamente)
   - Segundo: Pacientes
   - Tercero: Tipos de cita y Consultorios (si aún no existen)
   - Cuarto: Citas

5. **Pacientes Temporales**
   - Usar modo básico para registro rápido
   - Completar información posteriormente desde la interfaz
   - Marcar `pendingCompletion: true` explícitamente o dejar campos vacíos

## Soporte

Si tiene problemas con la importación:

1. Revisar los mensajes de error
2. Consultar esta guía
3. Verificar los archivos de ejemplo
4. Contactar al administrador del sistema
