import { NextRequest, NextResponse } from 'next/server'
import { syncExpiredDocuments, syncOverdueActionPoints } from '@/lib/documents'
import {
  processEventReminders,
  processScheduledAnnouncements,
  retryFailedAnnouncementEmailsBatch,
} from '@/app/actions/announcements'

export const dynamic = 'force-dynamic'

/**
 * Sync cron (NOT backups — Supabase owns DB backups):
 * - Expire documents / overdue action points
 * - Event reminder emails
 * - Scheduled announcements
 * - Retry failed announcement emails (up to 3)
 * Protect with Authorization: Bearer $CRON_SECRET (or ?secret=).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const auth = req.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const querySecret = req.nextUrl.searchParams.get('secret')
  if (bearer !== secret && querySecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [expiredDocuments, overdueActionPoints, eventReminders, scheduledAnnouncements, emailRetries] =
    await Promise.all([
      syncExpiredDocuments(),
      syncOverdueActionPoints(),
      processEventReminders(),
      processScheduledAnnouncements(),
      retryFailedAnnouncementEmailsBatch(),
    ])

  return NextResponse.json({
    ok: true,
    expiredDocuments,
    overdueActionPoints,
    eventReminders,
    scheduledAnnouncements,
    emailRetries,
    at: new Date().toISOString(),
  })
}
