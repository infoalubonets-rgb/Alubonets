'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'

export async function actionDeleteFailedPayment(id: string) {
  const profile = await requireActiveRole(['TREASURER', 'ADMIN'])
  await prisma.auditLog.delete({ where: { id, action: 'MPESA_STK_FAILED' } })
  await writeAudit({ userId: profile.id, action: 'DELETE_FAILED_PAYMENT', entity: 'AuditLog', entityId: id })
  revalidateTag('payments')
}

export async function actionDeleteFailedPayments(ids: string[]) {
  const profile = await requireActiveRole(['TREASURER', 'ADMIN'])
  await prisma.auditLog.deleteMany({ where: { id: { in: ids }, action: 'MPESA_STK_FAILED' } })
  await writeAudit({ userId: profile.id, action: 'DELETE_FAILED_PAYMENTS_BULK', entity: 'AuditLog', meta: { count: ids.length } })
  revalidateTag('payments')
}

export async function actionDeleteAllFailedPayments() {
  const profile = await requireActiveRole(['TREASURER', 'ADMIN'])
  const count = await prisma.auditLog.count({ where: { action: 'MPESA_STK_FAILED' } })
  await prisma.auditLog.deleteMany({ where: { action: 'MPESA_STK_FAILED' } })
  await writeAudit({ userId: profile.id, action: 'DELETE_FAILED_PAYMENTS_ALL', entity: 'AuditLog', meta: { count } })
  revalidateTag('payments')
}
