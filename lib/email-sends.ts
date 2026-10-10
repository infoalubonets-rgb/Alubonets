import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'

/** How long a finished send stays in the banner so the admin sees the final result. */
const FINISHED_WINDOW_MS = 60_000

export type ActiveEmailSend = {
  id: string
  title: string
  total: number
  sent: number
  failed: number
  pending: number
  finished: boolean
}

/** Lean query behind the admin email-send banner poll — keep this file free of heavy imports. */
export async function getActiveEmailSends(): Promise<ActiveEmailSend[]> {
  try {
    const profile = await getSessionProfile()
    if (!profile || (profile.role !== 'ADMIN' && !profile.isSuperAdmin)) return []
    const sends = await prisma.announcement.findMany({
      where: {
        OR: [
          { status: 'SENDING' },
          // Just finished, with email recipients — shown once as "sent to N of N".
          { status: 'SENT', publishedAt: { gte: new Date(Date.now() - FINISHED_WINDOW_MS) }, receipts: { some: {} } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        receipts: { select: { emailStatus: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    })
    return sends.map((a) => {
      const total = a.receipts.length
      const sent = a.receipts.filter((r) => r.emailStatus === 'SENT' || r.emailStatus === 'SKIPPED').length
      const failed = a.receipts.filter((r) => r.emailStatus === 'FAILED').length
      const pending = Math.max(0, total - sent - failed)
      return { id: a.id, title: a.title, total, sent, failed, pending, finished: a.status !== 'SENDING' && pending === 0 }
    })
  } catch {
    return []
  }
}
