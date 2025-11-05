
# Guía de Importación de Datos

Esta guía describe cómo importar datos masivos a la clínica usando archivos CSV o JSON.

## Formatos Soportados

El sistema soporta dos formatos de archivo:
- **CSV**: Valores separados por comas
- **JSON**: Formato de objetos JavaScript

## Tipos de Importación

### 1. Importación de Pacientes

#### Campos Requeridos
- `firstName` (string): Nombre del paciente
- `lastName` (string): Apellido paterno
- `phone` (string): Teléfono de contacto

#### Campos Opcionales
- `secondLastName` (string): Apellido materno
- `email` (string): Correo electrónico
- `birthDate` (string): Fecha de nacimiento en formato YYYY-MM-DD
- `gender` (string): Género (MALE, FEMALE, OTHER)
- `address` (string): Dirección completa
- `emergencyContact` (string): Contacto de emergencia
- `notes` (string): Notas adicionales

#### Ejemplo CSV
```csv
firstName,lastName,secondLastName,phone,email,birthDate,gender,address,emergencyContact,notes
Juan,García,Pérez,+52 55 1234 5678,juan.garcia@email.com,1980-05-15,MALE,"Av. Reforma 123, CDMX","María García - +52 55 1234 5679",Paciente con diabetes
```

Ver archivo de ejemplo completo: `patients-import-example.csv` o `patients-import-example.json`

### 2. Importación de Doctores

#### Campos Requeridos
- `firstName` (string): Nombre del doctor
- `lastName` (string): Apellido del doctor
- `license` (string): Número de cédula profesional (debe ser único)

#### Campos Opcionales
- `specialty` (string): Especialidad médica
- `phone` (string): Teléfono de contacto
- `email` (string): Correo electrónico
- `acronym` (string): Acrónimo para IDs de pacientes (2-3 letras, default: primeras letras del nombre)

#### Ejemplo CSV
```csv
firstName,lastName,license,specialty,phone,email,acronym
Eduardo,Hernández,MED-001-CDM,Cardiología,+52 55 2345 6789,eduardo.hernandez@email.com,EH
```

Ver archivo de ejemplo completo: `doctors-import-example.csv` o `doctors-import-example.json`

### 3. Importación de Usuarios

#### Campos Requeridos
- `email` (string): Correo electrónico (debe ser único)
- `password` (string): Contraseña (se encriptará automáticamente)
- `firstName` (string): Nombre
- `lastName` (string): Apellido
- `role` (string): Rol (ADMIN, CLINIC_ADMIN, RECEPTION, NURSE, DOCTOR, PATIENT)

#### Campos Opcionales
- `phone` (string): Teléfono
- `address` (string): Dirección
- `dateOfBirth` (string): Fecha de nacimiento en formato YYYY-MM-DD
- `specialty` (string): Especialidad (solo para rol DOCTOR)
- `licenseNumber` (string): Número de cédula (solo para rol DOCTOR)

### 4. Importación de Citas

#### Campos Requeridos
- `patientCustomId` (string): ID del paciente (ej: CEH0001)
- `doctorLicense` (string): Cédula del doctor
- `date` (string): Fecha de la cita en formato YYYY-MM-DD
- `startTime` (string): Hora de inicio en formato HH:MM
- `endTime` (string): Hora de fin en formato HH:MM

#### Campos Opcionales
- `appointmentTypeName` (string): Nombre del tipo de cita
- `roomName` (string): Nombre de la sala
- `customReason` (string): Motivo personalizado
- `customPrice` (number): Precio personalizado
- `notes` (string): Notas adicionales
- `status` (string): Estado (PENDING, CONFIRMED, IN_CONSULTATION, PAID, COMPLETED, CANCELLED, NO_SHOW, REQUIRES_RESCHEDULE)

## Reglas de Validación

### Formatos de Datos

1. **Fechas**: Usar formato ISO 8601 (YYYY-MM-DD)
   - Ejemplo: `2024-12-25`

2. **Horas**: Usar formato de 24 horas (HH:MM)
   - Ejemplo: `14:30`

3. **Teléfonos**: Incluir código de país
   - Ejemplo: `+52 55 1234 5678`

4. **Género**: Usar valores exactos
   - Válidos: `MALE`, `FEMALE`, `OTHER`

5. **Roles**: Usar valores exactos
   - Válidos: `ADMIN`, `CLINIC_ADMIN`, `RECEPTION`, `NURSE`, `DOCTOR`, `PATIENT`

### Consideraciones Importantes

1. **Unicidad**
   - Cédulas de doctores deben ser únicas
   - Emails de usuarios deben ser únicos
   - No puede haber dos citas para el mismo doctor a la misma hora
   - No puede haber dos citas en la misma sala a la misma hora

2. **Referencias**
   - Al importar citas, los pacientes y doctores referenciados deben existir previamente
   - Los tipos de cita y salas deben estar creados antes

3. **Codificación**
   - Los archivos CSV deben usar codificación UTF-8
   - Usar comillas dobles para campos con comas o saltos de línea

4. **Límites**
   - Máximo 1000 registros por archivo
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

4. **"Schedule conflict"**
   - Ya existe una cita a esa hora para ese doctor o sala

5. **"Invalid gender"**
   - Usar solo MALE, FEMALE, u OTHER

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
   - Primero: Usuarios y Doctores
   - Segundo: Pacientes
   - Tercero: Tipos de cita y Salas
   - Cuarto: Citas

## Soporte

Si tiene problemas con la importación:
1. Revisar los mensajes de error
2. Consultar esta guía
3. Verificar los archivos de ejemplo
4. Contactar al administrador del sistema
