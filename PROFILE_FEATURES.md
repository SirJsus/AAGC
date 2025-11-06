# Funcionalidades de Perfil de Usuario

## Resumen

Se ha implementado un sistema completo de gestión de perfil personal para la ruta `/me`, permitiendo a cada usuario editar su propia información y cambiar su contraseña.

## Componentes Creados

### 1. EditProfileDialog (`components/profile/edit-profile-dialog.tsx`)

Diálogo modal para editar información personal del usuario:

**Campos editables:**

- Nombre(s)
- Apellido Paterno
- Apellido Materno (con opción de marcar "No tengo apellido materno")
- Teléfono
- Dirección

**Características:**

- Validación de formularios con Zod
- Manejo de estado con React Hook Form
- Solo el usuario propietario puede editar su perfil
- Actualización automática de la interfaz después de guardar

### 2. ChangePasswordDialog (`components/profile/change-password-dialog.tsx`)

Diálogo modal para cambiar la contraseña:

**Campos:**

- Contraseña actual
- Nueva contraseña
- Confirmar nueva contraseña

**Características:**

- Verificación de contraseña actual
- Validación de requisitos de seguridad:
  - Mínimo 8 caracteres
  - Al menos una letra minúscula
  - Al menos una letra mayúscula
  - Al menos un número
- Verificación de que la nueva contraseña sea diferente a la actual
- Confirmación de contraseña
- Toggle de visibilidad de contraseñas

## Endpoints de API

### 1. PATCH `/api/users/[userId]/profile`

Actualiza la información personal del usuario.

**Seguridad:**

- Requiere autenticación
- Solo el propietario puede actualizar su perfil

**Body:**

```json
{
  "firstName": "string",
  "lastName": "string",
  "secondLastName": "string (opcional)",
  "noSecondLastName": "boolean",
  "phone": "string (opcional)",
  "address": "string (opcional)"
}
```

### 2. PATCH `/api/users/[userId]/password`

Cambia la contraseña del usuario.

**Seguridad:**

- Requiere autenticación
- Solo el propietario puede cambiar su contraseña
- Verifica la contraseña actual
- Valida requisitos de seguridad
- Hashea la contraseña con bcrypt

**Body:**

```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

## Página Actualizada

### `/app/(dashboard)/me/page.tsx`

La página de perfil ahora muestra:

**Tarjeta de Información Personal:**

- Nombre completo (con ambos apellidos)
- Email
- Teléfono (si está disponible)
- Dirección (si está disponible)
- Rol
- Clínica (si está asignada)
- Botón "Editar Perfil"

**Tarjeta de Seguridad:**

- Contraseña (oculta)
- Botón "Cambiar Contraseña"

**Tarjeta de Estado de la Cuenta:**

- Nivel de acceso
- Lista de permisos según el rol

## Flujo de Trabajo

### Editar Perfil:

1. Usuario hace clic en "Editar Perfil"
2. Se abre el diálogo con los datos actuales
3. Usuario modifica los campos deseados
4. Al guardar, se envía PATCH a `/api/users/[userId]/profile`
5. Si es exitoso, se actualiza la UI y se muestra notificación

### Cambiar Contraseña:

1. Usuario hace clic en "Cambiar Contraseña"
2. Se abre el diálogo de cambio de contraseña
3. Usuario ingresa contraseña actual y nueva contraseña
4. Sistema valida requisitos de seguridad
5. Al guardar, se envía PATCH a `/api/users/[userId]/password`
6. Se verifica la contraseña actual en el backend
7. Si es exitoso, se hashea y guarda la nueva contraseña
8. Se muestra notificación de éxito

## Seguridad

- ✅ Solo el propietario de la cuenta puede editar su perfil
- ✅ Verificación de contraseña actual antes de cambiar
- ✅ Hasheo de contraseñas con bcrypt
- ✅ Validación de requisitos de contraseña segura
- ✅ Protección de endpoints con autenticación
- ✅ Validación de datos con Zod
- ✅ La nueva contraseña debe ser diferente a la actual

## Mejoras Futuras Posibles

- [ ] Agregar campo de fecha de nacimiento editable
- [ ] Subir foto de perfil
- [ ] Historial de cambios de contraseña
- [ ] Notificación por email al cambiar contraseña
- [ ] Autenticación de dos factores
- [ ] Configuración de notificaciones
