
'use server'

import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConsentType, Prisma } from '@prisma/client'
import { createAuditLog } from './audit'

export interface CreateConsentInput {
  patientId: string
  type: ConsentType
  title: string
  content: string
  granted: boolean
  version?: string
}

export interface UpdateConsentInput {
  id: string
  granted?: boolean
  revokedAt?: Date | null
}

export async function getConsentsByPatient(patientId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  const consents = await prisma.consent.findMany({
    where: {
      patientId,
      deletedAt: null,
      isActive: true
    },
    orderBy: [
      { type: 'asc' },
      { createdAt: 'desc' }
    ]
  })

  return consents
}

export async function getConsentById(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  const consent = await prisma.consent.findFirst({
    where: {
      id,
      deletedAt: null
    },
    include: {
      patient: {
        select: {
          id: true,
          customId: true,
          firstName: true,
          lastName: true
        }
      }
    }
  })

  return consent
}

export async function createConsent(data: CreateConsentInput) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  // Verificar que el paciente existe
  const patient = await prisma.patient.findUnique({
    where: { id: data.patientId, deletedAt: null }
  })

  if (!patient) {
    throw new Error('Paciente no encontrado')
  }

  const consent = await prisma.consent.create({
    data: {
      patientId: data.patientId,
      type: data.type,
      title: data.title,
      content: data.content,
      granted: data.granted,
      grantedAt: data.granted ? new Date() : null,
      version: data.version || '1.0'
    }
  })

  // Audit log
  await createAuditLog({
    userId: session.user.id,
    clinicId: patient.clinicId,
    action: 'CREATE',
    entityType: 'Consent',
    entityId: consent.id,
    newValues: consent as unknown as Prisma.JsonObject
  })

  return consent
}

export async function updateConsent(data: UpdateConsentInput) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  const existing = await prisma.consent.findUnique({
    where: { id: data.id, deletedAt: null },
    include: { patient: true }
  })

  if (!existing) {
    throw new Error('Consentimiento no encontrado')
  }

  const updateData: Prisma.ConsentUpdateInput = {}

  if (data.granted !== undefined) {
    updateData.granted = data.granted
    updateData.grantedAt = data.granted ? new Date() : null
  }

  if (data.revokedAt !== undefined) {
    updateData.revokedAt = data.revokedAt
  }

  const consent = await prisma.consent.update({
    where: { id: data.id },
    data: updateData
  })

  // Audit log
  await createAuditLog({
    userId: session.user.id,
    clinicId: existing.patient.clinicId,
    action: 'UPDATE',
    entityType: 'Consent',
    entityId: consent.id,
    oldValues: existing as unknown as Prisma.JsonObject,
    newValues: consent as unknown as Prisma.JsonObject
  })

  return consent
}

export async function deleteConsent(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  const existing = await prisma.consent.findUnique({
    where: { id, deletedAt: null },
    include: { patient: true }
  })

  if (!existing) {
    throw new Error('Consentimiento no encontrado')
  }

  const consent = await prisma.consent.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false
    }
  })

  // Audit log
  await createAuditLog({
    userId: session.user.id,
    clinicId: existing.patient.clinicId,
    action: 'DELETE',
    entityType: 'Consent',
    entityId: consent.id,
    oldValues: existing as unknown as Prisma.JsonObject
  })

  return consent
}

export async function revokeConsent(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  return updateConsent({
    id,
    granted: false,
    revokedAt: new Date()
  })
}

export async function grantConsent(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  return updateConsent({
    id,
    granted: true,
    revokedAt: null
  })
}
