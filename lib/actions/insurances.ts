
'use server'

import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { createAuditLog } from './audit'

export interface CreateInsuranceInput {
  patientId: string
  provider: string
  policyNumber: string
  groupNumber?: string
  expiryDate?: Date
}

export interface UpdateInsuranceInput {
  id: string
  provider?: string
  policyNumber?: string
  groupNumber?: string
  expiryDate?: Date
  isActive?: boolean
}

export async function getInsurancesByPatient(patientId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  const insurances = await prisma.insurance.findMany({
    where: {
      patientId,
      deletedAt: null
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return insurances
}

export async function getInsuranceById(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  const insurance = await prisma.insurance.findFirst({
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

  return insurance
}

export async function createInsurance(data: CreateInsuranceInput) {
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

  const insurance = await prisma.insurance.create({
    data: {
      patientId: data.patientId,
      provider: data.provider,
      policyNumber: data.policyNumber,
      groupNumber: data.groupNumber || null,
      expiryDate: data.expiryDate || null
    }
  })

  // Audit log
  await createAuditLog({
    userId: session.user.id,
    clinicId: patient.clinicId,
    action: 'CREATE',
    entityType: 'Insurance',
    entityId: insurance.id,
    newValues: insurance as unknown as Prisma.JsonObject
  })

  return insurance
}

export async function updateInsurance(data: UpdateInsuranceInput) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  const existing = await prisma.insurance.findUnique({
    where: { id: data.id, deletedAt: null },
    include: { patient: true }
  })

  if (!existing) {
    throw new Error('Seguro no encontrado')
  }

  const insurance = await prisma.insurance.update({
    where: { id: data.id },
    data: {
      provider: data.provider,
      policyNumber: data.policyNumber,
      groupNumber: data.groupNumber,
      expiryDate: data.expiryDate,
      isActive: data.isActive
    }
  })

  // Audit log
  await createAuditLog({
    userId: session.user.id,
    clinicId: existing.patient.clinicId,
    action: 'UPDATE',
    entityType: 'Insurance',
    entityId: insurance.id,
    oldValues: existing as unknown as Prisma.JsonObject,
    newValues: insurance as unknown as Prisma.JsonObject
  })

  return insurance
}

export async function deleteInsurance(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  const existing = await prisma.insurance.findUnique({
    where: { id, deletedAt: null },
    include: { patient: true }
  })

  if (!existing) {
    throw new Error('Seguro no encontrado')
  }

  const insurance = await prisma.insurance.update({
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
    entityType: 'Insurance',
    entityId: insurance.id,
    oldValues: existing as unknown as Prisma.JsonObject
  })

  return insurance
}
