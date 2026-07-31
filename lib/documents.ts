import type { Document, Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export function isDocumentExpired(
  document: Pick<Document, 'status' | 'expiresAt'>,
  now = new Date(),
) {
  if (document.status === 'EXPIRED') return true
  return Boolean(document.expiresAt && document.expiresAt < now)
}

export function canReadDocument(
  document: Pick<Document, 'accessLevel' | 'allowedRoles' | 'status' | 'expiresAt'>,
  role: Role,
) {
  const expired = isDocumentExpired(document)
  if (document.status === 'ARCHIVED' || expired) {
    return role === 'ADMIN' || role === 'SECRETARY'
  }
  if (document.status !== 'PUBLISHED') return role === 'ADMIN' || role === 'SECRETARY'
  if (document.accessLevel === 'PUBLIC' || document.accessLevel === 'MEMBERS') return true
  if (document.accessLevel === 'ADMIN_SECRETARY') return role === 'ADMIN' || role === 'SECRETARY'
  return document.allowedRoles.includes(role) || role === 'ADMIN' || role === 'SECRETARY'
}

/** Mark published documents past expiresAt as EXPIRED. Returns count updated. */
export async function syncExpiredDocuments(now = new Date()) {
  const result = await prisma.document.updateMany({
    where: {
      status: 'PUBLISHED',
      expiresAt: { lt: now },
    },
    data: { status: 'EXPIRED' },
  })
  return result.count
}

/** Mark open action points past due as OVERDUE. Returns count updated. */
export async function syncOverdueActionPoints(now = new Date()) {
  const result = await prisma.meetingActionPoint.updateMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      dueAt: { lt: now },
    },
    data: { status: 'OVERDUE' },
  })
  return result.count
}
