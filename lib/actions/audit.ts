
'use server'

import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AuditAction, Prisma } from '@prisma/client'

export interface CreateAuditLogInput {
  userId: string
  clinicId?: string
  action: AuditAction
  entityType: string
  entityId?: string
  oldValues?: Prisma.JsonObject
  newValues?: Prisma.JsonObject
  metadata?: Prisma.JsonObject
  ipAddress?: string
  userAgent?: string
}

export async function createAuditLog(data: CreateAuditLogInput) {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        userId: data.userId,
        clinicId: data.clinicId || null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId || null,
        oldValues: data.oldValues ? data.oldValues : Prisma.JsonNull,
        newValues: data.newValues ? data.newValues : Prisma.JsonNull,
        metadata: data.metadata ? data.metadata : Prisma.JsonNull,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null
      }
    })

    return auditLog
  } catch (error) {
    console.error('Error creating audit log:', error)
    // No lanzar error para no interrumpir la operación principal
    return null
  }
}

export async function getAuditLogs(filters: {
  clinicId?: string
  userId?: string
  action?: AuditAction
  entityType?: string
  entityId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  const where: Prisma.AuditLogWhereInput = {}

  if (filters.clinicId) {
    where.clinicId = filters.clinicId
  }

  if (filters.userId) {
    where.userId = filters.userId
  }

  if (filters.action) {
    where.action = filters.action
  }

  if (filters.entityType) {
    where.entityType = filters.entityType
  }

  if (filters.entityId) {
    where.entityId = filters.entityId
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: filters.limit || 50,
      skip: filters.offset || 0
    }),
    prisma.auditLog.count({ where })
  ])

  return { logs, total }
}

export async function getAuditLogById(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  const log = await prisma.auditLog.findUnique({
    where: { id }
  })

  return log
}

export async function getEntityHistory(entityType: string, entityId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('No autorizado')
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      entityType,
      entityId
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return logs
}
