import { NextRequest, NextResponse } from 'next/server'
import { syncExpiredDocuments, syncOverdueActionPoints } from '@/lib/documents'
import {
  processEventReminders,
  processScheduledAnnouncements,
  retryFailedAnnouncementEmailsBatch,
} from '@/app/actions/announcements'
import { syncMembershipStanding } from '@/lib/membership-standing-sync'
import { syncProjectStatuses } from '@/lib/project-status'
import { revalidateTag } from 'next/cache'
import { TAGS } from '@/lib/data/queries'
import { withDatabaseRetry } from '@/lib/database-retry'

export const dynamic = 'force-dynamic'

/**
 * Sync cron (NOT backups — Supabase owns DB backups):
 * - Expire documents / overdue action points
 * - Event reminder emails
 * - Scheduled announcements
 * - Retry failed announcement emails (up to 3)
 * - Membership standing (paid-up / lapsed)
 * Protect with Authorization: Bearer $CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const auth = req.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  // Header only: a secret in the URL ends up in access logs and browser history.
  if (bearer !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // The production function has a small Prisma pool. Launching seven database-heavy
  // sweeps together can exhaust it; run them in order and retry transient pool errors.
  const failures: string[] = []
  async function runTask<T>(name: string, task: () => Promise<T>, retry = false): Promise<T | { error: string }> {
    try {
      // Retry only sweeps whose writes are idempotent. Email jobs can have sent
      // a message before a later database failure and must not be replayed here.
      return retry ? await withDatabaseRetry(task, { attempts: 3, delaysMs: [250, 1000] }) : await task()
    } catch (error) {
      console.error(`Cron task ${name} failed`, error)
      failures.push(name)
      return { error: 'Task failed' }
    }
  }

  const expiredDocuments = await runTask('expiredDocuments', syncExpiredDocuments, true)
  const overdueActionPoints = await runTask('overdueActionPoints', syncOverdueActionPoints, true)
  const eventReminders = await runTask('eventReminders', processEventReminders)
  const scheduledAnnouncements = await runTask('scheduledAnnouncements', processScheduledAnnouncements)
  const emailRetries = await runTask('emailRetries', retryFailedAnnouncementEmailsBatch)
  const membershipStanding = await runTask('membershipStanding', syncMembershipStanding, true)
  const projectStatuses = await runTask('projectStatuses', syncProjectStatuses, true)
  if (!('error' in projectStatuses) && projectStatuses.updated > 0) revalidateTag(TAGS.projects)

  return NextResponse.json({
    ok: failures.length === 0,
    failures,
    expiredDocuments,
    overdueActionPoints,
    eventReminders,
    scheduledAnnouncements,
    emailRetries,
    membershipStanding,
    projectStatuses,
    at: new Date().toISOString(),
  }, { status: failures.length ? 500 : 200 })
}
