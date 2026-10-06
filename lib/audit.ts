import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { actingRoleFor, auditActorRole, isOutsidePrimaryRole } from '@/lib/audit-roles'

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
    // Snapshot the actor's primary role now, so a later role change can't hide what they did.
    const actor = entry.userId
      ? await prisma.user.findUnique({ where: { id: entry.userId }, select: { role: true, isSuperAdmin: true, dashboardAccess: true } })
      : null
    const actorRole = actor ? auditActorRole(actor) : null
    const actorSecondaryRoles = (actor?.dashboardAccess ?? []).filter((role) => role !== actorRole)
    await prisma.auditLog.create({
      data: {
        actorRole,
        actorSecondaryRoles,
        actingRole: actingRoleFor(entry.action, actorRole, actorSecondaryRoles),
        outsideRole: isOutsidePrimaryRole(entry.action, actorRole),
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
