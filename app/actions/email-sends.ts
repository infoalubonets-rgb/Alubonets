'use server'

import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'

/** Lean poll endpoint for the admin email-send banner — keep this file free of heavy imports. */
export async function getActiveEmailSends() {
  try {
    const profile = await getSessionProfile()
    if (!profile || (profile.role !== 'ADMIN' && !profile.isSuperAdmin)) return []
    const sending = await prisma.announcement.findMany({
      where: { status: 'SENDING' },
      select: {
        id: true,
        title: true,
        receipts: { select: { emailStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return sending.map((a) => {
      const total = a.receipts.length
      const sent = a.receipts.filter((r) => r.emailStatus === 'SENT' || r.emailStatus === 'SKIPPED').length
      const failed = a.receipts.filter((r) => r.emailStatus === 'FAILED').length
      return { id: a.id, title: a.title, total, sent, failed, pending: Math.max(0, total - sent - failed) }
    })
  } catch {
    return []
  }
}
