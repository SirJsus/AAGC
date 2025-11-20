# 🗺️ Roadmap de Implementación de Features - AAGC

**Fecha de creación:** 20 de noviembre de 2025  
**Proyecto:** AAGC - Sistema de Gestión Clínica  
**Rama:** develop  
**Última actualización:** 20 de noviembre de 2025

---

## 🎯 Resumen Ejecutivo

Este documento define el plan de implementación de **5 features principales** y **8 mejoras adicionales** para el sistema AAGC, ordenadas estratégicamente por:

- Complejidad técnica
- Dependencias entre módulos
- Impacto en el sistema existente
- Valor agregado al negocio

**Duración estimada total:** 12-18 semanas (3-4.5 meses)

### ⚠️ Notas Importantes

> **Sistema de Consentimientos:** La Feature #5 (Almacenamiento en Nube) incluye una **mejora significativa al sistema de consentimientos actual**. Se implementará la gestión de consentimientos firmados mediante **PDFs escaneados con firma física** (NO firma electrónica digital por ahora). Esto permitirá digitalizar el archivo físico de consentimientos y tener respaldo digital de todos los documentos firmados por pacientes.

### 📑 Índice Rápido

**Features Principales:**

1. [Notas de Consultas (Historial Médico)](#1️⃣-prioridad-alta---notas-de-consultas-historial-médico) - 1-2 semanas
2. [Sistema de Reportes](#2️⃣-prioridad-alta---sistema-de-reportes) - 2-3 semanas
3. [Portal de Pacientes](#3️⃣-prioridad-media---portal-de-pacientes) - 3-4 semanas
4. [Automatización de Confirmación de Citas](#4️⃣-prioridad-media---automatización-de-confirmación-de-citas) - 2-3 semanas
5. [Sistema de Almacenamiento en la Nube](#5️⃣-prioridad-baja---sistema-de-almacenamiento-en-la-nube) + Consentimientos Mejorados - 4-6 semanas

**Mejoras Adicionales:**

- Recordatorios Internos, Calendarios, Facturación CFDI, Métricas Real-time, **Consentimientos Mejorados**, i18n, PWA, Reviews, Telemedicina

---

## 📋 Orden de Implementación Recomendado

Las features están ordenadas por complejidad, dependencias y valor agregado al sistema existente.

---

## 1️⃣ PRIORIDAD ALTA - Notas de Consultas (Historial Médico)

**Complejidad:** BAJA-MEDIA ⭐⭐⚪⚪⚪  
**Impacto en sistema:** BAJO - Se integra sin modificar flujos existentes  
**Tiempo estimado:** 1-2 semanas

### ¿Por qué primero?

- Es la funcionalidad más **autocontenida** y menos invasiva
- No requiere integraciones externas
- Solo necesita extender el modelo `Appointment` existente
- Agrega valor inmediato a los médicos en su práctica diaria

### Implementación Técnica

#### Base de Datos

- Agregar modelo `ConsultationNote` o `MedicalRecord` en Prisma
- Relación con `Appointment` y `Patient`
- Campos sugeridos:
  - `diagnosis` (diagnóstico)
  - `prescription` (receta médica)
  - `requestedStudies` (estudios solicitados)
  - `vitalSigns` (signos vitales)
  - `observations` (observaciones generales)
  - `followUpInstructions` (indicaciones de seguimiento)
  - `attachments` (para futuro: documentos adjuntos)

#### Frontend

- Interfaz para capturar notas durante/después de la consulta
- Editor rico de texto (Tiptap o similar) para recetas
- Visualización de historial médico completo en perfil del paciente
- Timeline de consultas previas
- Búsqueda y filtrado de notas históricas

#### Permisos

- Solo médicos pueden crear/editar notas de sus propias consultas
- Recepción/enfermeras pueden ver (solo lectura)
- ADMIN/CLINIC_ADMIN acceso completo

---

## 2️⃣ PRIORIDAD ALTA - Sistema de Reportes

**Complejidad:** MEDIA ⭐⭐⭐⚪⚪  
**Impacto en sistema:** BAJO - No modifica flujos, solo lee datos  
**Tiempo estimado:** 2-3 semanas

### ¿Por qué segundo?

- Usa datos existentes sin modificarlos
- Fundamental para toma de decisiones administrativas
- No requiere integraciones externas
- Puede implementarse en paralelo con otras features

### Implementación Técnica

#### Reportes a Implementar

**A. Dashboard General (KPIs)**

- Total de citas por período
- Tasa de cancelación/no-show
- Ingresos totales vs proyectados
- Ocupación promedio de consultorios
- Nuevos pacientes vs recurrentes

**B. Reportes Financieros**

- Ingresos por período (día/semana/mes/año)
- Ingresos por forma de pago
- Cuentas por cobrar (TRANSFER_PENDING)
- Desglose por tipo de cita
- Comparativas período vs período anterior

**C. Reportes por Doctor**

- Citas completadas vs canceladas
- Honorarios generados
- Promedio de pacientes por día
- Duración promedio de consultas
- Tasa de seguimiento

**D. Reportes por Paciente**

- Frecuencia de visitas
- Gasto total histórico
- Historial de pagos
- Adeudos pendientes

**E. Reportes Operativos**

- Ocupación de consultorios por horario
- Horas pico de atención
- Tiempos de espera promedio
- Eficiencia de agenda

#### Tecnologías

- **Backend:** Queries optimizadas con Prisma + agregaciones
- **Frontend:** Recharts o Chart.js para visualizaciones
- **Exportación:** Excel (xlsx), PDF (jsPDF/Puppeteer)
- **Filtros:** Por fecha, doctor, clínica, tipo de cita

---

## 3️⃣ PRIORIDAD MEDIA - Portal de Pacientes

**Complejidad:** MEDIA-ALTA ⭐⭐⭐⭐⚪  
**Impacto en sistema:** MEDIO - Modifica flujo de registro de pacientes  
**Tiempo estimado:** 3-4 semanas

### ¿Por qué tercero?

- Reduce carga administrativa significativamente
- Base necesaria para confirmación automática de citas
- Mejora experiencia del paciente
- Requiere autenticación especial con URLs temporales

### Implementación Técnica

#### Sistema de Tokens Temporales

- Modelo `PatientPortalToken` en base de datos
- Token único generado al crear/actualizar cita
- Expiración configurable (24-72 horas)
- URL tipo: `https://aagc.com/portal/p/{token}`

#### Funcionalidades del Portal

**A. Para Pacientes Temporales (sin datos completos)**

- Formulario de completado de datos personales
- Validación en tiempo real
- Transición automática a paciente completo
- Confirmación de cita incluida

**B. Para Pacientes Completos**

- Vista de citas programadas
- Historial de citas pasadas
- Actualización de datos personales
- Información de contacto de emergencia
- Datos de facturación

**C. Seguridad**

- No requiere contraseña (acceso por token)
- Rate limiting por IP
- Tokens de un solo uso para acciones críticas
- Logs de acceso en `AuditLog`

#### Flujo Completo

```
1. Cita creada → Token generado
2. Email/SMS enviado con enlace al portal
3. Paciente accede con token
4. Completa/actualiza datos
5. Sistema valida y actualiza
6. Token se marca como usado
```

---

## 4️⃣ PRIORIDAD MEDIA - Automatización de Confirmación de Citas

**Complejidad:** MEDIA-ALTA ⭐⭐⭐⭐⚪  
**Impacto en sistema:** MEDIO - Integración con servicios externos  
**Tiempo estimado:** 2-3 semanas

### ¿Por qué cuarto?

- Depende idealmente del portal de pacientes
- Requiere integración con servicios externos
- Necesita configuración de webhooks/cron jobs
- Automatiza proceso manual actual

### Implementación - Opción A: n8n (Recomendada)

#### Ventajas

- Interface visual para workflows
- Fácil mantenimiento sin código
- Múltiples integraciones incluidas
- Self-hosted o cloud

#### Arquitectura

```
AAGC API ←→ n8n ←→ Twilio/WhatsApp/Email
```

#### Workflow n8n

1. **Trigger:** Cron cada 1 hora
2. **HTTP Request:** Consulta API de AAGC (`/api/appointments/pending-confirmation`)
3. **Filter:** Citas a X horas de la fecha (configurable: 24h, 48h)
4. **Branch por canal:**
   - WhatsApp (Twilio)
   - SMS (Twilio)
   - Email (SendGrid/Resend)
5. **HTTP Request:** Envía mensaje con enlace al portal
6. **HTTP Request:** Actualiza estado en AAGC

#### API Endpoints Necesarios

- `GET /api/appointments/pending-confirmation`
- `POST /api/appointments/{id}/send-reminder`
- `POST /api/appointments/{id}/confirm` (webhook desde portal)

### Implementación - Opción B: Integración Directa

#### Stack Tecnológico

- **SMS/WhatsApp:** Twilio API
- **Email:** Resend o SendGrid
- **Scheduler:** Vercel Cron (si está en Vercel) o Bull/BullMQ
- **Cola de mensajes:** Redis + Bull para procesamiento asíncrono

#### Componentes

1. **Cron Job:** `/api/cron/send-reminders`
2. **Service:** `lib/services/notification-service.ts`
3. **Templates:** Mensajes predefinidos personalizables
4. **Queue:** Procesa envíos sin bloquear

---

## 5️⃣ PRIORIDAD BAJA - Sistema de Almacenamiento en la Nube

**Complejidad:** ALTA ⭐⭐⭐⭐⭐  
**Impacto en sistema:** ALTO - Modifica múltiples partes del sistema  
**Tiempo estimado:** 4-6 semanas

### ¿Por qué al final?

- Más complejo: gestión de archivos, seguridad, permisos
- Necesita infraestructura adicional
- Debe cumplir normativas de datos médicos sensibles (HIPAA-like)
- Requiere portal de pacientes funcional
- Mayor costo operativo

### Implementación Técnica

#### Proveedor de Almacenamiento

**Opciones evaluadas:**

| Proveedor            | Ventajas                          | Desventajas               | Costo Estimado   |
| -------------------- | --------------------------------- | ------------------------- | ---------------- |
| **AWS S3**           | Estándar industria, muy confiable | Configuración compleja    | ~$0.023/GB/mes   |
| **Cloudflare R2**    | Sin costos de egress, económico   | Relativamente nuevo       | ~$0.015/GB/mes   |
| **Supabase Storage** | Integrado, fácil setup            | Dependencia de Supabase   | Incluido en plan |
| **UploadThing**      | Específico Next.js, muy fácil     | Limitaciones en plan free | $0-20/mes        |

**Recomendación:** Cloudflare R2 por costo-beneficio

#### Modelo de Datos

```prisma
model Document {
  id            String       @id @default(cuid())
  patientId     String
  uploadedBy    String       // userId
  category      DocumentType
  fileName      String
  fileUrl       String       // URL en storage
  fileSize      Int          // bytes
  mimeType      String
  description   String?
  consentId     String?      // Relación con Consent si es CONSENT_FORM
  isEncrypted   Boolean      @default(true)
  encryptionKey String?      // Si aplica encriptación adicional
  isActive      Boolean      @default(true)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  deletedAt     DateTime?

  patient       Patient      @relation(...)
  uploader      User         @relation(...)
  consent       Consent?     @relation(fields: [consentId], references: [id])

  @@index([patientId])
  @@index([category])
  @@index([consentId])
}

// Modelo Consent EXTENDIDO para incluir documento PDF firmado
model Consent {
  id           String      @id @default(cuid())
  patientId    String
  type         ConsentType
  title        String
  content      String
  granted      Boolean     @default(false)
  grantedAt    DateTime?
  revokedAt    DateTime?
  signedBy     String?     // Nombre de quien firma (paciente o representante)
  witnessName  String?     // Nombre del testigo (opcional)
  version      String      @default("1.0")
  isActive     Boolean     @default(true)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  deletedAt    DateTime?

  patient      Patient     @relation(...)
  documents    Document[]  // PDFs escaneados del consentimiento firmado

  @@index([patientId])
  @@index([type])
  @@index([granted])
  @@index([isActive])
}

enum DocumentType {
  MEDICAL_STUDY       // Estudios médicos (laboratorio, rayos X, etc.)
  PRESCRIPTION        // Recetas
  CONSENT_FORM        // Consentimientos firmados (PDFs escaneados)
  INVOICE             // Facturas
  INSURANCE           // Documentos de seguro
  IDENTIFICATION      // INE, pasaporte
  TAX_DOCUMENT        // RFC, constancia fiscal
  OTHER
}
```

#### Funcionalidades

**A. Subida de Documentos**

- Drag & drop interface
- Validación de tipo y tamaño
- Preview antes de subir
- Procesamiento asíncrono para archivos grandes
- Compresión automática de imágenes
- **Upload específico para consentimientos:** vincula automáticamente PDF escaneado con registro de consentimiento

**B. Organización**

- Carpetas por categoría
- Tags personalizados
- Búsqueda por nombre/fecha/categoría
- Ordenamiento múltiple
- **Sección especial para consentimientos firmados** en perfil de paciente

**C. Visualización**

- Visor integrado para PDF (esencial para consentimientos)
- Galería para imágenes
- Player para videos (si aplica)
- Vista previa de documentos Office
- **Vista de consentimiento con PDF escaneado adjunto**

**D. Seguridad**

- URLs pre-firmadas con expiración
- Control de acceso por rol
- Encriptación en reposo
- Logs de acceso/descarga en `AuditLog`
- Watermark en documentos sensibles
- **Protección especial para consentimientos:** solo personal autorizado

**E. Límites y Cuotas**

- Por paciente: 100 MB
- Por tipo de archivo: PDF, JPG, PNG, DOCX (configurable)
- Tamaño máximo por archivo: 10 MB
- **Consentimientos en PDF:** máximo 5 MB por documento
- Retención: documentos eliminados van a papelera (30 días)

**F. Sistema de Consentimientos Mejorado**

> **Nota:** Por ahora, únicamente será manejo de documentos PDF escaneados con firma física, **no firmas digitales electrónicas**.

- **Gestión digital sin firma electrónica:** PDF escaneado con firma física
- **Flujo de trabajo:**
  1. Crear registro de consentimiento en sistema (funcionalidad actual)
  2. Imprimir formato de consentimiento
  3. Paciente firma físicamente el documento
  4. Escanear documento firmado
  5. Subir PDF escaneado y vincularlo al registro del consentimiento
  6. Sistema marca consentimiento como "completo" (granted + documento adjunto)
- **Estados del consentimiento:**
  - `DRAFT`: Creado pero no firmado
  - `PENDING_SIGNATURE`: Impreso, esperando firma del paciente
  - `SIGNED_PENDING_UPLOAD`: Firmado físicamente, falta escanear y subir
  - `COMPLETE`: Firmado y PDF escaneado subido al sistema
  - `REVOKED`: Revocado por el paciente
- **Validaciones:**
  - No permitir borrar consentimientos con documento PDF adjunto (soft delete únicamente)
  - Alertar si consentimiento tiene > 30 días sin PDF escaneado
  - Requerir consentimientos específicos antes de ciertos procedimientos
  - Validar que PDF subido sea legible (opcional: OCR básico)
- **Componentes UI:**
  - Extensión del `ConsentDialog` actual para subir PDF
  - Botón "Subir consentimiento firmado" en tabla de consentimientos
  - Indicador visual de estado del consentimiento
  - Vista previa del PDF en modal al hacer clic

#### APIs Necesarias

- `POST /api/documents/upload`
- `GET /api/documents/{id}/download`
- `GET /api/patients/{id}/documents`
- `DELETE /api/documents/{id}`
- `POST /api/documents/{id}/share` (genera enlace temporal)

---

## 🎯 Sugerencias Adicionales para Pulir el Proyecto

### 6️⃣ Mejoras Rápidas de Alto Impacto

#### A. Sistema de Recordatorios Internos

**Tiempo:** 3-5 días  
**Complejidad:** Baja

- Notificaciones in-app para citas próximas del día
- Alertas de pacientes con datos incompletos
- Recordatorios de seguimiento médico
- Badge counter en navegación

#### B. Integración con Calendario Externo

**Tiempo:** 1 semana  
**Complejidad:** Media

- Export a Google Calendar (.ics)
- Export a Outlook Calendar
- Sincronización bidireccional (opcional, más complejo)
- Webhooks para cambios en calendario externo

#### C. Sistema de Facturación Mejorado (CFDI 4.0)

**Tiempo:** 2-3 semanas  
**Complejidad:** Media-Alta

- Integración con Facturama, PAC Avalara, o similar
- Generación automática de facturas
- Ya tienes datos fiscales del paciente ✅
- Envío automático por email
- Portal de descarga de facturas
- Complemento de pago

#### D. Métricas en Tiempo Real

**Tiempo:** 1 semana  
**Complejidad:** Media

- Dashboard con citas del día en curso
- Estado de sala de espera virtual
- Ocupación actual de consultorios
- Alertas de retrasos
- WebSocket o polling para actualizaciones

#### E. Sistema de Consentimientos Mejorado (Integrado con Almacenamiento)

**Tiempo:** 1-2 semanas  
**Complejidad:** Media  
**Dependencia:** Debe implementarse junto con Feature #5 (Almacenamiento en Nube)

> Esta mejora extiende el sistema de consentimientos actual para permitir la carga de PDFs escaneados con firmas físicas.

**Características:**

- **Modelo extendido:** Agregar campos `signedBy`, `witnessName` al modelo `Consent` existente
- **Relación con documentos:** Un consentimiento puede tener uno o múltiples PDFs adjuntos (original + copias)
- **Estados del consentimiento:**
  - `DRAFT`: Borrador sin firmar
  - `PENDING_SIGNATURE`: Impreso, esperando firma
  - `SIGNED_PENDING_UPLOAD`: Firmado, pendiente de escanear
  - `COMPLETE`: Firmado y digitalizado
  - `REVOKED`: Revocado
- **Flujo mejorado:**
  1. Crear consentimiento en sistema (estado: DRAFT)
  2. Generar PDF del formato para imprimir
  3. Paciente firma físicamente (estado: PENDING_SIGNATURE)
  4. Escanear documento firmado
  5. Subir PDF vía interfaz de documentos (estado: COMPLETE)
  6. Sistema vincula automáticamente PDF con consentimiento
- **UI/UX:**
  - Botón "Subir documento firmado" en tabla de consentimientos
  - Drag & drop de PDF escaneado
  - Vista previa del PDF en modal
  - Indicador visual del estado del consentimiento
  - Timeline de historial (creado → firmado → digitalizado → revocado)
- **Validaciones:**
  - Solo PDF permitido (máx 5 MB)
  - No permitir eliminar consentimientos con PDF adjunto
  - Alertas automáticas si consentimiento > 30 días sin PDF
  - Verificar que archivo sea PDF válido antes de subir
- **Reportes:**
  - Consentimientos pendientes de firma
  - Consentimientos firmados sin digitalizar
  - Tasa de completitud de consentimientos

**Nota:** Esta implementación NO incluye firma digital electrónica. Es únicamente manejo de documentos PDF escaneados con firma física tradicional.

#### F. Multi-idioma (i18n)

**Tiempo:** 1-2 semanas  
**Complejidad:** Media

- Ya tienes campo `locale` en modelo `Clinic` ✅
- Implementar next-intl o next-i18next
- Español (MX) como base
- Inglés (US) como secundario
- Switcheo de idioma por usuario/clínica

#### G. Progressive Web App (PWA)

**Tiempo:** 3-5 días  
**Complejidad:** Baja

- Service Worker para cache
- Manifest.json para instalación
- Notificaciones push web
- Modo offline básico (solo lectura)
- Mejora UX en móviles

#### H. Sistema de Calificaciones y Feedback

**Tiempo:** 1 semana  
**Complejidad:** Baja-Media

**Modelo:**

```prisma
model AppointmentReview {
  id              String   @id @default(cuid())
  appointmentId   String   @unique
  rating          Int      // 1-5 estrellas
  feedback        String?
  wouldRecommend  Boolean
  createdAt       DateTime @default(now())

  appointment     Appointment @relation(...)
}
```

- Email post-consulta con enlace a encuesta
- Dashboard de satisfacción por doctor
- NPS (Net Promoter Score)
- Comentarios anónimos opcionales

#### H. Telemedicina Básica

**Tiempo:** 2-3 semanas  
**Complejidad:** Alta

**Stack sugerido:**

- **Video:** Daily.co, Jitsi, o Agora
- **Chat:** Socket.io o Ably
- **Screen sharing:** WebRTC nativo

**Features:**

- Sala de espera virtual
- Videoconsultas 1-a-1
- Chat en tiempo real médico-paciente
- Compartir pantalla (para revisar estudios)
- Grabación de consultas (con consentimiento)
- Tipo de cita "VIRTUAL" en enum

---

## 📊 Cronograma Visual Estimado

```
┌────────────────────────────────────────────────────────────────┐
│ Mes 1  │ 1. Notas de Consultas         [████████░░] 1-2 sem   │
│        │ 2. Reportes Básicos            [██████████] 2-3 sem   │
├────────────────────────────────────────────────────────────────┤
│ Mes 2  │ 3. Portal de Pacientes         [████████████] 3-4 sem│
├────────────────────────────────────────────────────────────────┤
│ Mes 3  │ 4. Confirmación Automática     [██████████] 2-3 sem  │
│        │    Mejoras adicionales (A-D)   [████░░░░░░] 1-2 sem   │
├────────────────────────────────────────────────────────────────┤
│ Mes 4+ │ 5. Almacenamiento en Nube      [██████████████] 4-6s │
│        │    Mejoras adicionales (E-H)   [████████████] Variable│
└────────────────────────────────────────────────────────────────┘

📅 Duración total: 12-18 semanas (3-4.5 meses) para features core
📅 Con mejoras adicionales: 5-6 meses para proyecto completo
```

---

## 🚀 Plan de Acción por Fases

### **Fase 1: Fundamentos Médicos** (Mes 1)

✅ Implementar notas de consultas  
✅ Sistema de reportes básico  
✅ Mejoras de UX generales

**Entregables:**

- Historial médico funcional
- Dashboard de métricas
- Reportes exportables

---

### **Fase 2: Automatización** (Mes 2)

✅ Portal de pacientes completo  
✅ Sistema de tokens y URLs temporales  
✅ Formularios de auto-registro

**Entregables:**

- Portal público para pacientes
- Reducción de carga administrativa
- Auto-completado de datos

---

### **Fase 3: Comunicación** (Mes 3)

✅ Confirmación automática de citas  
✅ Integración con n8n o Twilio  
✅ Templates de mensajes  
✅ Reportes avanzados

**Entregables:**

- Recordatorios automáticos
- Confirmaciones por WhatsApp/SMS/Email
- Analytics detallados

---

### **Fase 4: Expansión** (Mes 4+)

✅ Almacenamiento en la nube  
✅ Sistema de facturación CFDI  
✅ Features opcionales según prioridad

**Entregables:**

- Gestión de documentos médicos
- Facturación electrónica
- Features premium seleccionadas

---

## 🔧 Stack Tecnológico Recomendado

### Core (Ya existente)

- **Framework:** Next.js 14+ (App Router)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js
- **UI:** Tailwind CSS + shadcn/ui
- **Estado:** React Hooks + Server Actions

### Nuevas Integraciones

#### Para Notificaciones

- **Email:** Resend (moderno, DX excelente)
- **SMS/WhatsApp:** Twilio
- **Automation:** n8n (self-hosted o cloud)

#### Para Reportes

- **Charts:** Recharts o Apache ECharts
- **Export Excel:** xlsx o exceljs
- **Export PDF:** jsPDF + jsPDF-AutoTable o Puppeteer

#### Para Almacenamiento

- **Storage:** Cloudflare R2
- **Upload UI:** Uppy o React Dropzone
- **Preview:** React-PDF para PDFs (esencial para consentimientos)
- **PDF Generation:** jsPDF o Puppeteer (para generar formatos de consentimiento)
- **Validation:** PDF-parse o similar (verificar que PDF sea válido)

#### Para Facturación

- **PAC:** Facturama API
- **QR Generator:** qrcode o node-qrcode

#### Opcional - Mejoras

- **i18n:** next-intl
- **Real-time:** Pusher, Ably, o Socket.io
- **Video:** Daily.co (telemedicina)
- **Queue:** Bull + Redis (jobs asíncronos)

---

## 📝 Checklist de Preparación

Antes de comenzar cada feature:

### Pre-implementación

- [ ] Revisar modelo de datos actual
- [ ] Identificar dependencias con otros módulos
- [ ] Diseñar nuevas tablas/modelos en Prisma
- [ ] Definir permisos y roles necesarios
- [ ] Crear mockups/wireframes de UI (opcional pero recomendado)

### Durante implementación

- [ ] Escribir migraciones de Prisma
- [ ] Implementar server actions/API routes
- [ ] Crear componentes de UI
- [ ] Agregar validaciones (Zod schemas)
- [ ] Implementar manejo de errores
- [ ] Agregar logs en AuditLog

### Post-implementación

- [ ] Testing manual exhaustivo
- [ ] Verificar permisos por rol
- [ ] Documentar cambios en código
- [ ] Actualizar PROFILE_FEATURES.md si aplica
- [ ] Deploy a staging para QA
- [ ] Recopilar feedback
- [ ] Iterar según necesidades

---

## 🎯 KPIs de Éxito por Feature

### 1. Notas de Consultas

- ✅ 80%+ de consultas con notas capturadas
- ✅ Tiempo promedio de captura < 3 minutos
- ✅ Médicos reportan mejora en seguimiento

### 2. Sistema de Reportes

- ✅ Reportes generados en < 5 segundos
- ✅ Usuarios acceden a reportes 2+ veces/semana
- ✅ Decisiones basadas en data aumentan

### 3. Portal de Pacientes

- ✅ 70%+ pacientes completan datos vía portal
- ✅ Reducción 50%+ en llamadas para confirmar datos
- ✅ Tiempo de registro reducido 60%

### 4. Confirmación Automática

- ✅ 90%+ mensajes enviados exitosamente
- ✅ Tasa de confirmación > 70%
- ✅ Reducción en no-shows del 30%+

### 5. Almacenamiento en Nube

- ✅ 100% documentos accesibles < 2 segundos
- ✅ 0 pérdidas de documentos
- ✅ Cumplimiento de normativas de seguridad
- ✅ 90%+ de consentimientos con PDF escaneado adjunto
- ✅ Tiempo de subida de consentimiento < 1 minuto
- ✅ Reducción 80%+ en búsqueda de documentos físicos

### 6. Sistema de Consentimientos Mejorado

- ✅ 95%+ consentimientos digitalizados en < 7 días de firma
- ✅ 0 consentimientos perdidos o extraviados
- ✅ Tiempo de recuperación de consentimiento < 10 segundos
- ✅ 100% cumplimiento normativo de documentación

---

## 💡 Notas Finales

### Filosofía de Desarrollo

1. **Iterativo sobre perfecto:** Lanza MVP, mejora con feedback
2. **Usuario primero:** UX simple y clara sobre features complejas
3. **Seguridad médica:** Datos sensibles requieren máxima protección
4. **Performance:** Clínicas ocupadas requieren rapidez
5. **Escalabilidad:** Pensar en multi-clínica desde ahora

### Riesgos a Considerar

- **Regulatorio:** Verificar cumplimiento con NOM-024-SSA3-2012 (expediente clínico electrónico)
- **GDPR/LFPDPPP:** Protección de datos personales en México
- **Disponibilidad:** Sistema crítico, requiere uptime > 99%
- **Backup:** Estrategia robusta para datos médicos (especialmente documentos escaneados)
- **Migraciones:** Planear bien cambios de schema con data existente
- **Consentimientos informados:**
  - Validez legal de consentimientos escaneados vs. físicos
  - Consultar con legal sobre requisitos de NOM-004-SSA3-2012
  - Establecer proceso de respaldo físico mientras se digitaliza
  - Considerar futura migración a firma electrónica avanzada (e.firma)
- **Almacenamiento:**
  - Costos de storage pueden crecer significativamente con PDFs
  - Establecer política de retención y eliminación de documentos
  - Plan de disaster recovery para documentos críticos

---

## 📞 Próximos Pasos

1. **Definir prioridad final** con stakeholders
2. **Asignar recursos** (tiempo/presupuesto)
3. **Comenzar con Feature #1:** Notas de Consultas
4. **Iterar y aprender** de cada implementación
5. **Celebrar cada hito** ✨

---

**Documento creado:** 20/11/2025  
**Última actualización:** 20/11/2025  
**Versión:** 1.0  
**Mantenido por:** Equipo de Desarrollo AAGC
