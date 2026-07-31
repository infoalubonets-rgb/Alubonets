import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type AuditEntry = {
  userId?: string | null
  action: string
  entity?: string | null
  entityId?: string | null
  meta?: Prisma.InputJsonValue
  oldValue?: Prisma.InputJsonValue
  newValue?: Prisma.InputJsonValue
  reason?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

/** Never throws — a failed audit insert must not break the user action. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        meta: entry.meta ?? undefined,
        oldValue: entry.oldValue ?? undefined,
        newValue: entry.newValue ?? undefined,
        reason: entry.reason ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    })
  } catch (e) {
    console.error('audit log failed', entry.action, e)
  }
}

export { formatAuditAction, formatAuditMeta, ACTION_LABELS } from '@/lib/audit-labels'
