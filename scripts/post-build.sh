#!/bin/bash
# Post-build script para Vercel
# Se ejecuta después del build para migrar y seedear la base de datos

echo "🚀 Running post-build script..."

# Ejecutar migraciones
echo "📦 Running migrations..."
npx prisma migrate deploy

# Verificar si la DB necesita seed (checando si existe al menos un usuario)
echo "🔍 Checking if database needs seeding..."

# Usar prisma para verificar si existen usuarios
USER_COUNT=$(npx prisma db execute --stdin <<EOF
SELECT COUNT(*) FROM "User";
EOF
2>/dev/null | grep -oP '\d+' | tail -1)

if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" -eq "0" ]; then
  echo "🌱 Database is empty. Running seed..."
  npm run db:seed
  echo "✅ Seed completed!"
else
  echo "✅ Database already has data. Skipping seed."
fi

echo "🎉 Post-build completed!"
