'use server'

import { revalidateTag } from 'next/cache'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'

/**
 * Failed STK push attempts are retained in the audit trail.
 * Clearing them from the UI is no longer allowed (Stage 4.3 append-only policy).
 */
export async function actionDeleteFailedPayment(id: string) {
  const profile = await requireActiveRole(['TREASURER', 'ADMIN'])
  await writeAudit({
    userId: profile.id,
    action: 'DELETE_FAILED_PAYMENT_DENIED',
    entity: 'AuditLog',
    entityId: id,
    reason: 'Audit records are append-only; failed STK events are retained until retention purge',
  })
  throw new Error('Failed payment audit records cannot be deleted. They are retained for accountability.')
}

export async function actionDeleteFailedPayments(ids: string[]) {
  const profile = await requireActiveRole(['TREASURER', 'ADMIN'])
  await writeAudit({
    userId: profile.id,
    action: 'DELETE_FAILED_PAYMENTS_BULK_DENIED',
    entity: 'AuditLog',
    reason: 'Bulk delete blocked by append-only audit policy',
    meta: { count: ids.length },
  })
  throw new Error('Failed payment audit records cannot be deleted. They are retained for accountability.')
}

export async function actionDeleteAllFailedPayments() {
  const profile = await requireActiveRole(['TREASURER', 'ADMIN'])
  await writeAudit({
    userId: profile.id,
    action: 'DELETE_FAILED_PAYMENTS_ALL_DENIED',
    entity: 'AuditLog',
    reason: 'Clear-all blocked by append-only audit policy',
  })
  revalidateTag('payments')
  throw new Error('Failed payment audit records cannot be deleted. They are retained for accountability.')
}
