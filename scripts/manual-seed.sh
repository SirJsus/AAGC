#!/bin/bash
# Script para ejecutar seed manualmente en producción

echo "🌱 Running production seed..."

# Asegúrate de tener DATABASE_URL configurada
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL no está configurada"
  exit 1
fi

# Ejecutar seed
npx prisma db seed

echo "✅ Seed completed!"
