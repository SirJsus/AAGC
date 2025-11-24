# Sistema de Reportes - AAGC

## 📊 Descripción

Sistema completo de reportes y análisis para la clínica AAGC, implementado según la **Feature #2** del roadmap.

## ✨ Características Implementadas

### 🔒 Control de Acceso

- **Acceso exclusivo**: Solo usuarios con rol `ADMIN` o `CLINIC_ADMIN`
- Validación a nivel de página y API
- Implementado mediante `Permissions.canViewReports()`

### 🎛️ Filtros Dinámicos

#### 1. Filtro por Clínica (Solo ADMIN)

- **Exclusivo para usuarios ADMIN**: Permite seleccionar entre todas las clínicas del sistema
- Opción "Todas las clínicas" para vista global
- Selección individual por clínica específica
- Lista dinámica de todas las clínicas activas
- **Comportamiento**: Al seleccionar una clínica, los filtros de Doctor y Tipo de Cita se actualizan automáticamente

#### 2. Período de Tiempo

- **Hoy**: Citas del día actual
- **Esta Semana**: Lunes a domingo de la semana actual
- **Este Mes**: Del 1 al último día del mes actual (por defecto)
- **Este Año**: Del 1 de enero al 31 de diciembre
- **Rango Personalizado**: Selección manual de fecha inicio y fin con calendarios

#### 3. Filtro por Doctor

- Opción "Todos los doctores" para vista general
- Selección individual por doctor específico
- Lista dinámica cargada según la clínica seleccionada (o todas si es ADMIN sin filtro)

#### 4. Filtro por Tipo de Cita

- Opción "Todos los tipos" para vista completa
- Selección por tipo específico de cita
- Lista dinámica según tipos configurados en la clínica seleccionada

### 📈 Métricas y KPIs

#### Resumen Ejecutivo (Cards)

1. **Total de Citas**: Contador con comparativa vs período anterior (+/- %)
2. **Ingresos Confirmados**: Total de citas completadas y pagadas
3. **Ingresos Proyectados**: Estimado de citas pendientes y confirmadas
4. **Tasa de Cancelación**: Porcentaje de cancelaciones + no-shows

#### Gráficas Interactivas

**Tab: Resumen**

- 🥧 Citas por Estado (gráfica de pastel)
- 📊 Citas por Tipo (gráfica de barras)

**Tab: Por Doctor**

- 📊 Rendimiento por Doctor (completadas, canceladas, no-show)
- 💰 Ingresos por Doctor (gráfica de barras)

**Tab: Distribución**

- 📅 Citas por Día de la Semana (barras)
- 🕐 Citas por Hora del Día (línea temporal)

**Tab: Ingresos**

- 💳 Ingresos por Método de Pago (pastel)
- 💵 Ingresos por Tipo de Cita (barras)

#### Tablas Detalladas

**Tabla 1: Detalle por Doctor**

- Total de citas
- Citas completadas
- Citas canceladas
- No-shows
- Tasa de éxito (% completadas)
- Ingresos totales

**Tabla 2: Detalle por Tipo de Cita**

- Total de citas
- Ingresos totales
- Ingreso promedio por cita

### 🔄 Comparativas

- Comparación automática con período anterior
- Indicadores visuales de tendencia (↑/↓)
- Porcentaje de cambio calculado automáticamente

## 🗂️ Estructura de Archivos

```
app/
├── (dashboard)/
│   └── reports/
│       └── page.tsx              # Página principal de reportes
└── api/
    └── reports/
        └── route.ts              # API endpoint con toda la lógica

components/
└── reports/
    ├── reports-container.tsx     # Contenedor principal con state management
    ├── reports-filters.tsx       # Componente de filtros
    ├── reports-summary.tsx       # Cards de resumen (KPIs)
    ├── reports-charts.tsx        # Todas las gráficas (Recharts)
    └── reports-table.tsx         # Tablas detalladas

lib/
└── permissions.ts                # Agregado: canViewReports()
```

## 🚀 Uso

### Acceder a Reportes

1. Iniciar sesión como `ADMIN` o `CLINIC_ADMIN`
2. Navegar a "Reports" en el menú lateral
3. Seleccionar filtros deseados
4. Los reportes se actualizan automáticamente

### Ejemplos de Filtros

**Reporte mensual de un doctor específico (CLINIC_ADMIN):**

```text
Período: Este Mes
Doctor: Dr. Juan Pérez
Tipo de Cita: Todos los tipos
```

**Análisis semanal de citas de tipo "Consulta General":**

```text
Período: Esta Semana
Doctor: Todos los doctores
Tipo de Cita: Consulta General
```

**Reporte global de todas las clínicas (solo ADMIN):**

```text
Clínica: Todas las clínicas
Período: Este Mes
Doctor: Todos los doctores
Tipo de Cita: Todos los tipos
```

**Reporte de una clínica específica (solo ADMIN):**

```text
Clínica: Clínica Central
Período: Esta Semana
Doctor: Todos los doctores
Tipo de Cita: Todos los tipos
```

**Comparativa personalizada:**

```text
Período: Rango Personalizado
Fecha Inicio: 01/11/2025
Fecha Fin: 15/11/2025
Doctor: Todos los doctores
Tipo de Cita: Todos los tipos
```

## 🔧 API Endpoint

### GET `/api/reports`

**Query Parameters:**

- `period`: `day` | `week` | `month` | `year` | `custom`
- `clinicId`: ID de la clínica o `all` (solo para ADMIN)
- `doctorId`: ID del doctor o `all`
- `appointmentTypeId`: ID del tipo de cita o `all`
- `startDate`: ISO string (requerido si `period=custom`)
- `endDate`: ISO string (requerido si `period=custom`)

**Response:**

```typescript
{
  period: string;
  dateRange: {
    from: string;
    to: string;
  }
  summary: {
    totalAppointments: number;
    totalRevenue: number;
    projectedRevenue: number;
    cancellationRate: string;
    appointmentChange: string;
  }
  appointmentsByStatus: Record<string, number>;
  appointmentsByDoctor: Record<string, any>;
  appointmentsByType: Record<string, any>;
  appointmentsByWeekday: Record<string, number>;
  appointmentsByHour: Record<string, number>;
  revenueByPaymentMethod: Record<string, number>;
}
```

## 🎨 Tecnologías Utilizadas

- **Framework**: Next.js 14 (App Router)
- **Gráficas**: Recharts 2.15.3
- **Fechas**: date-fns 3.6.0
- **UI**: shadcn/ui + Tailwind CSS
- **Base de Datos**: PostgreSQL + Prisma ORM

## 📝 Notas Técnicas

### Cálculo de Ingresos

- **Ingresos Confirmados**: Solo citas con estado `COMPLETED` o `PAID`
- **Precio utilizado**: `customPrice` (si existe) o `appointmentType.price`
- **Moneda**: MXN (pesos mexicanos)

### Estados de Citas Considerados

```typescript
enum AppointmentStatus {
  PENDING           // Pendiente
  CONFIRMED         // Confirmada
  IN_CONSULTATION   // En Consulta
  TRANSFER_PENDING  // Pago Pendiente
  COMPLETED         // Completada
  CANCELLED         // Cancelada
  PAID              // Pagada
  NO_SHOW           // No Asistió
  REQUIRES_RESCHEDULE // Requiere Reagendar
}
```

### Métodos de Pago

```typescript
enum PaymentMethod {
  CASH         // Efectivo
  DEBIT_CARD   // Tarjeta Débito
  CREDIT_CARD  // Tarjeta Crédito
  TRANSFER     // Transferencia
}
```

## 🔐 Permisos

Función agregada en `lib/permissions.ts`:

```typescript
static canViewReports(user: PermissionCheck): boolean {
  return user.role === Role.ADMIN || user.role === Role.CLINIC_ADMIN;
}
```

## 🎯 Próximas Mejoras (Roadmap)

- [ ] Exportación a Excel (xlsx)
- [ ] Exportación a PDF con gráficas
- [ ] Reportes programados por email
- [ ] Más métricas: tiempo promedio de consulta, NPS, etc.
- [ ] Comparativa entre clínicas (para ADMIN)
- [ ] Filtros adicionales: por sala, por estado de pago, etc.

## ✅ Checklist de Implementación

- [x] Página de reportes protegida por permisos
- [x] API endpoint con filtros dinámicos
- [x] Componentes de filtros (período, doctor, tipo)
- [x] Cards de resumen con KPIs
- [x] Gráficas de pastel (estados, pagos)
- [x] Gráficas de barras (doctores, tipos, días)
- [x] Gráfica de línea (horarios)
- [x] Tablas detalladas con datos tabulares
- [x] Comparativa con período anterior
- [x] Responsive design
- [x] Indicadores de carga
- [x] Manejo de errores
- [x] Navegación agregada al sidebar

---

**Fecha de implementación**: 24 de noviembre de 2025  
**Feature**: #2 del Roadmap - Sistema de Reportes  
**Estado**: ✅ Completado
