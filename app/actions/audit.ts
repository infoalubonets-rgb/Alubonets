'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/audit'

export async function deleteAuditRecord(formData: FormData) {
  const actor = await requireAdmin()
  const id = z.string().min(1).parse(formData.get('id'))
  const reason = z.string().trim().min(5).max(1000).parse(formData.get('reason'))
  const record = await prisma.auditLog.findUniqueOrThrow({ where: { id } })
  await prisma.auditLog.delete({ where: { id } })
  await writeAudit({ userId: actor.id, action: 'AUDIT_RECORD_DELETE', entity: 'AuditLog', entityId: id, reason, oldValue: { action: record.action, entity: record.entity, entityId: record.entityId, createdAt: record.createdAt } })
  revalidatePath('/admin/audit-logs')
}

