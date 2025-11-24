# Sistema de Reportes para Médicos

## Descripción

Sistema de reportes simplificado para médicos que les permite visualizar estadísticas y métricas de sus propias citas médicas. Esta es una versión simplificada del sistema de reportes administrativos, diseñada específicamente para el rol DOCTOR.

## Características

### Filtros Disponibles

- **Período**: Hoy, Esta semana, Este mes, Este año, Personalizado
- **Tipo de Cita**: Filtrar por tipos específicos de citas
- **Fechas Personalizadas**: Selección de rango de fechas específico

### Métricas Mostradas

1. **Resumen General**:
   - Total de citas
   - Ingresos totales generados
   - Ingresos proyectados (citas pendientes/confirmadas)
   - Tasa de cancelación
   - Cambio vs período anterior

2. **Visualizaciones**:
   - Distribución de citas por estado
   - Citas por tipo
   - Distribución por día de la semana
   - Distribución por hora del día
   - Ingresos por método de pago

3. **Tabla Detallada**:
   - Lista completa de todas las métricas calculadas

## Diferencias con el Sistema de Reportes Administrativos

### Sistema Administrativo (`/reports`)

- **Acceso**: Solo ADMIN y CLINIC_ADMIN
- **Filtros**: Por doctor, clínica, tipo de cita, período
- **Datos**: Todos los doctores y clínicas
- **Propósito**: Gestión general de la clínica

### Sistema de Médicos (`/my-reports`)

- **Acceso**: Solo DOCTOR
- **Filtros**: Tipo de cita y período (sin selector de doctor)
- **Datos**: Solo las citas del doctor actual
- **Propósito**: Auto-análisis de desempeño

## Estructura de Archivos

```
app/
  (dashboard)/
    my-reports/
      page.tsx                    # Página principal de reportes del médico
  api/
    my-reports/
      route.ts                    # Endpoint API con filtrado automático

components/
  reports/
    doctor-reports-container.tsx  # Contenedor principal
    doctor-reports-filters.tsx    # Filtros simplificados
    reports-summary.tsx           # Reutilizado del sistema admin
    reports-charts.tsx            # Reutilizado del sistema admin
    reports-table.tsx             # Reutilizado del sistema admin

lib/
  permissions.ts                  # Añadido: canViewOwnReports()
```

## Permisos

### Nuevo Método

```typescript
static canViewOwnReports(user: PermissionCheck): boolean {
  return user.role === Role.DOCTOR;
}
```

- Solo usuarios con rol `DOCTOR` pueden acceder
- El sistema filtra automáticamente por el ID del doctor actual
- No se permite ver datos de otros médicos

## Uso

### Para Médicos

1. Iniciar sesión con cuenta de tipo DOCTOR
2. Navegar a "My Reports" en el menú lateral
3. Seleccionar período de análisis
4. Filtrar opcionalmente por tipo de cita
5. Visualizar métricas y estadísticas personales

### Navegación

La nueva ruta aparece automáticamente en el menú de navegación solo para usuarios con rol DOCTOR.

## API Endpoint

### GET `/api/my-reports`

**Query Parameters**:

- `period`: `day` | `week` | `month` | `year` | `custom`
- `appointmentTypeId`: ID del tipo de cita (opcional, "all" para todos)
- `startDate`: Fecha inicial (solo para período custom)
- `endDate`: Fecha final (solo para período custom)

**Respuesta**:

```json
{
  "period": "month",
  "dateRange": {
    "from": "2025-11-01T00:00:00.000Z",
    "to": "2025-11-30T23:59:59.999Z"
  },
  "summary": {
    "totalAppointments": 45,
    "totalRevenue": 22500,
    "projectedRevenue": 15000,
    "cancellationRate": "8.89",
    "appointmentChange": "12.50"
  },
  "appointmentsByStatus": { ... },
  "appointmentsByDoctor": { ... },
  "appointmentsByType": { ... },
  "appointmentsByWeekday": { ... },
  "appointmentsByHour": { ... },
  "revenueByPaymentMethod": { ... }
}
```

## Seguridad

- **Autenticación**: Requiere sesión activa
- **Autorización**: Solo rol DOCTOR
- **Filtrado Automático**: Las consultas se filtran automáticamente por el doctor actual
- **Scope de Clínica**: Respeta el ámbito de la clínica del médico

## Ventajas

1. **Privacidad**: Los médicos solo ven sus propios datos
2. **Simplicidad**: Interfaz enfocada sin opciones innecesarias
3. **Reutilización**: Aprovecha componentes existentes del sistema admin
4. **Consistencia**: Mantiene el mismo diseño y UX del sistema principal
5. **Performance**: Consultas optimizadas al filtrar por un solo doctor

## Futuras Mejoras Potenciales

- [ ] Exportación de reportes a PDF/Excel
- [ ] Comparación entre períodos
- [ ] Gráficas de tendencias a largo plazo
- [ ] Alertas de bajo rendimiento
- [ ] Metas y objetivos personales
- [ ] Análisis de satisfacción del paciente
