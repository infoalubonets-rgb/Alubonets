import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'

/** How long a finished send stays in the banner so the admin sees the final result. */
const FINISHED_WINDOW_MS = 60_000
const STALE_SEND_MS = 15 * 60_000

export type ActiveEmailSend = {
  id: string
  title: string
  total: number
  sent: number
  failed: number
  pending: number
  finished: boolean
}

export async function recordAnnouncementEmailProgress(
  announcementId: string,
  result: { userId: string; ok: boolean; error?: string },
) {
  await prisma.announcementReceipt.updateMany({
    where: { announcementId, userId: result.userId, emailStatus: 'PENDING' },
    data: result.ok
      ? { emailStatus: 'SENT', emailSentAt: new Date(), emailError: null }
      : { emailStatus: 'FAILED', emailError: result.error ?? 'Email delivery failed.', retryCount: { increment: 1 } },
  })
}

export async function finishAnnouncementEmailProgress(announcementId: string, sent: number, failure?: string) {
  await prisma.announcementReceipt.updateMany({
    where: { announcementId, emailStatus: 'PENDING' },
    data: {
      emailStatus: 'FAILED',
      emailError: failure ?? 'Email delivery did not finish.',
      retryCount: { increment: 1 },
    },
  })
  await prisma.announcement.update({
    where: { id: announcementId },
    data: { status: 'SENT', ...(sent > 0 ? { emailSentAt: new Date() } : {}) },
  })
}

/** Lean query behind the admin email-send banner poll — keep this file free of heavy imports. */
export async function getActiveEmailSends(): Promise<ActiveEmailSend[]> {
  try {
    const profile = await getSessionProfile()
    if (!profile || (profile.role !== 'ADMIN' && !profile.isSuperAdmin)) return []
    // A crashed background task must not leave a banner spinning forever.
    const stale = await prisma.announcement.findMany({
      where: { status: 'SENDING', createdAt: { lt: new Date(Date.now() - STALE_SEND_MS) } },
      select: { id: true },
      take: 20,
    })
    if (stale.length) {
      const ids = stale.map((announcement) => announcement.id)
      await prisma.$transaction([
        prisma.announcementReceipt.updateMany({
          where: { announcementId: { in: ids }, emailStatus: 'PENDING' },
          data: { emailStatus: 'FAILED', emailError: 'Email delivery timed out.', retryCount: { increment: 1 } },
        }),
        prisma.announcement.updateMany({
          where: { id: { in: ids }, status: 'SENDING' },
          data: { status: 'SENT' },
        }),
      ])
    }
    const sends = await prisma.announcement.findMany({
      where: {
        OR: [
          { status: 'SENDING' },
          // Just finished, with email recipients — shown once as "sent to N of N".
          {
            status: 'SENT',
            publishedAt: { gte: new Date(Date.now() - FINISHED_WINDOW_MS) },
            receipts: { some: { emailStatus: { in: ['PENDING', 'SENT', 'FAILED'] } } },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        receipts: { where: { emailStatus: { in: ['PENDING', 'SENT', 'FAILED'] } }, select: { emailStatus: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    })
    return sends.map((a) => {
      const total = a.receipts.length
      const sent = a.receipts.filter((r) => r.emailStatus === 'SENT').length
      const failed = a.receipts.filter((r) => r.emailStatus === 'FAILED').length
      const pending = Math.max(0, total - sent - failed)
      return { id: a.id, title: a.title, total, sent, failed, pending, finished: a.status !== 'SENDING' && pending === 0 }
    })
  } catch {
    return []
  }
}
