# RESET_DB — Reiniciar la base de datos y volver a sembrar (seed)

Este documento explica cómo dejar la base de datos del proyecto en cero (sin datos) y luego ejecutar la seed provista en `scripts/seed.ts`.

IMPORTANTE:

- Estas instrucciones asumen que la base de datos es PostgreSQL y que `DATABASE_URL` en tu archivo `.env` apunta a la base de datos de desarrollo correcta.
- Haz un backup antes de borrar datos en caso de que necesites recuperar información.
- Los comandos están pensados para ejecutarse en zsh sobre Linux.

## 1) Hacer backup (opcional pero recomendado)

Reemplaza `postgres://...` con tu `DATABASE_URL` o usa las variables de entorno apropiadas.

Ejemplo con `pg_dump` (local):

```bash
# Exportar a un archivo SQL
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
# Opcional: extraer host/port/user para pg_dump si prefieres
pg_dump "$DATABASE_URL" -f backup-$(date +%F).sql
```

Si usas una base de datos remota (Cloud), consulta la doc del proveedor para snapshots/backups.

## 2) Parar la aplicación (si está corriendo)

Si tienes la app corriendo en `next dev` o similar, detenla antes de operar la BD.

```bash
# Si la iniciaste en la terminal, Ctrl+C; si es un servicio systemd o docker, usa los comandos apropiados.
```

## 3) Borrar y reconstruir la base de datos con Prisma

La forma más sencilla cuando usas Prisma es usar `prisma migrate reset`, que elimina los datos, recrea el esquema según las migraciones y (opcionalmente) ejecuta el seed.

1. Asegúrate de que `DATABASE_URL` está exportada (o presente en `.env`):

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
# o carga el .env
# source .env
```

2. Ejecutar reset (esto eliminará todos los datos):

```bash
# Esta operación hace DROP de los datos y recrea según migraciones.
# --force evita la confirmación interactiva
npx prisma migrate reset --force
```

Tras ejecutar esto, Prisma intentará ejecutar el script de seed configurado en `package.json` (campo `prisma.seed`) si existe.

> Nota: en este repositorio `package.json` contiene:
> "prisma": { "seed": "tsx --require dotenv/config scripts/seed.ts" }
>
> Lo que significa que `npx prisma db seed` lanzará `tsx --require dotenv/config scripts/seed.ts`.

### Opciones para crear/aplicar el esquema antes de ejecutar la seed

Si al ejecutar la seed obtienes un error tipo P2021 (tablas inexistentes), significa que el esquema de Prisma no está aplicado en la base de datos. Aquí tienes tres opciones seguras según tu flujo de trabajo:

- Opción A — Rápida (dev): crear las tablas sin generar migraciones
  - Uso: útil para levantar rápidamente la BD en desarrollo cuando no necesitas historial de migraciones.
  - Comandos:

    ```bash
    export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
    # Crea las tablas directamente desde schema.prisma
    npx prisma db push
    # Genera el cliente de Prisma (opcional pero recomendado)
    npx prisma generate
    # Ejecuta la seed
    npx prisma db seed
    ```

  - Pros: rápido, no afecta migraciones.
  - Contras: no deja historial de migraciones (no recomendable si quieres versionar cambios en la BD).

- Opción B — Correcta (migraciones): crear una migración y aplicarla
  - Uso: recomendado si quieres mantener historial de cambios y usar migraciones en CI/CD.
  - Comandos:

    ```bash
    export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
    # Crea y aplica una migración interactiva para el estado actual del schema
    npx prisma migrate dev --name init
    # Ejecuta la seed
    npx prisma db seed
    ```

  - Pros: crea la carpeta `prisma/migrations` con historial; reproducible.
  - Contras: requiere crear y revisar las migraciones; ligeramente más lento.

- Opción C — Destructiva (reset completo): borrar y recrear todo
  - Uso: cuando no te importa perder datos (por ejemplo en un entorno de pruebas) y quieres recrear todo desde cero.
  - Comandos:

    ```bash
    export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
    # Elimina datos y reaplica migraciones (si existen)
    npx prisma migrate reset --force
    # Si no se ejecutó automáticamente la seed, ejecutarla explícitamente:
    npx prisma db seed
    ```

  - Pros: asegura un estado limpio y consistente.
  - Contras: destructivo — elimina todos los datos. Haz backup si hay algo que quieras conservar.

Elige la opción A si solo necesitas levantar la base en dev rápido. Elige la opción B si vas a versionar migraciones y necesitas historial. Elige la opción C solo si quieres un borrado completo y tienes backup o no te importa perder datos.

## 4) Ejecutar la seed manualmente (alternativa)

Si quieres controlar la ejecución de la seed manualmente (recomendado para ver logs y errores), puedes ejecutar:

```bash
# Usando el comando configurado en package.json (recomendado)
npx prisma db seed

# O ejecutar directamente el script TypeScript con tsx (idéntico al seed configurado)
npx tsx --require dotenv/config scripts/seed.ts
```

La seed hará upserts y creará usuarios, doctores, pacientes, citas de ejemplo, etc. Observa la salida en la terminal para credenciales de demo.

## 5) Comprobaciones rápidas después del reset+seed

- Conecta a la base de datos con `psql` o una GUI (pgAdmin, TablePlus) y valida que:
  - Existe al menos una `Clinic` (Global Cardio)
  - Hay usuarios con emails `admin@demo.com`, `clinicadmin@demo.com`, `reception@demo.com`, `nurse@demo.com`, `doctor1@demo.com`, `doctor2@demo.com`, `doctor3@demo.com`
  - Existen pacientes con `customId` con formato `{ClinicAcronym}-{DoctorAcronym}-{Letter}{Number}`

Ejemplo rápido con psql (reemplaza DATABASE_URL):

```bash
psql "$DATABASE_URL" -c "select id, name, clinicAcronym from \"Clinic\" limit 5;"
psql "$DATABASE_URL" -c "select email, role from \"User\" limit 10;"
```

## 6) Problemas frecuentes y soluciones

- Error: `prisma migrate reset` falla por permisos o conexiones activas
  - Asegúrate de que no haya conexiones activas que impidan drop (cierra la aplicación y sesiones SQL). Si usas Docker, asegúrate de que el contenedor está accesible.

- Error al ejecutar seed (errores de tipos o de integridad)
  - Revisa la salida de la seed en la terminal; habitualmente indica qué registro falló y por qué.
  - Asegúrate de que las migraciones aplicadas en la base están en sincronía con `prisma/schema.prisma`.

- Si prefieres recrear la base manualmente en Postgres:

```bash
# WARNING: esto eliminará la base de datos completamente
PGPASSWORD=your_pwd psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS dbname;"
PGPASSWORD=your_pwd psql -h localhost -U postgres -c "CREATE DATABASE dbname;"
# Luego aplica migraciones
npx prisma migrate deploy
# O si estás en dev
npx prisma migrate reset --force
# y luego seed
npx prisma db seed
```

## 7) Recomendaciones

- Mantén copias de seguridad antes de operaciones destructivas.
- Ejecuta la seed en un entorno de staging o desarrollo, nunca en producción.
- Si quieres automatizar este flujo, puedes añadir scripts npm (por ejemplo `db:reset`) que ejecuten `prisma migrate reset --force && npx prisma db seed`.

---

Si quieres, puedo añadir un script npm `db:reset` al `package.json` o ejecutar el `npx prisma migrate reset --force` desde aquí para verificar que todo funcione (necesitaré confirmación porque es destructivo).
