import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyRoleHolders } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000
const WARNING_DAYS = 30
const LAST_WARNING_KEY = 'audit_retention_last_warning'

/**
 * Tells admins (at most once a week) how many audit entries will be deleted within the next
 * 30 days, so they can raise the retention period or export them first.
 */
async function warnBeforePurge(days: number) {
  const dueSoon = await prisma.auditLog.count({
    where: { createdAt: { lt: new Date(Date.now() - (days - WARNING_DAYS) * DAY_MS) } },
  })
  if (!dueSoon) return 0
  const last = await prisma.appSetting.findUnique({ where: { key: LAST_WARNING_KEY } })
  if (last && Date.now() - new Date(last.value).getTime() < 7 * DAY_MS) return 0
  await notifyRoleHolders(['ADMIN'], {
    title: `${dueSoon} audit log entr${dueSoon === 1 ? 'y' : 'ies'} will be deleted within ${WARNING_DAYS} days`,
    body: `Audit retention is set to ${days} days. Export them or increase the retention in Settings to keep them.`,
    href: '/admin/settings',
    type: 'AUDIT_RETENTION',
  })
  const now = new Date().toISOString()
  await prisma.appSetting.upsert({
    where: { key: LAST_WARNING_KEY },
    create: { key: LAST_WARNING_KEY, value: now },
    update: { value: now },
  })
  return dueSoon
}

/**
 * Retention purge (NOT backups — Supabase owns DB backups):
 * audit logs are kept forever unless Admin → Settings sets audit_retention_days. When a period
 * is set, rows older than it are deleted, and admins are warned 30 days before any row is due.
 * Protect with Authorization: Bearer $CRON_SECRET (or ?secret=).
 * Sets app.allow_audit_purge so the append-only trigger allows the delete.
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

  // Audit logs are kept forever unless an admin sets a retention period (0 or unset = forever).
  const retentionSetting = await prisma.appSetting.findUnique({
    where: { key: 'audit_retention_days' },
  })
  const days = Number(retentionSetting?.value || 0)
  const keepForever = !Number.isFinite(days) || days <= 0

  let deleted = 0
  let cutoff: Date | null = null
  let warnedAdmins = 0
  if (!keepForever) {
    cutoff = new Date(Date.now() - days * DAY_MS)
    const purgeBefore = cutoff
    deleted = Number(
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`
        return tx.$executeRaw`DELETE FROM "audit_logs" WHERE "createdAt" < ${purgeBefore}`
      }),
    )
    warnedAdmins = await warnBeforePurge(days)
  }

  const contacts = await prisma.contactSubmission.deleteMany({
    where: { retainUntil: { lte: new Date() }, status: { in: ['RESOLVED', 'SPAM'] } },
  })

  return NextResponse.json({
    ok: true,
    deleted,
    cutoff: cutoff?.toISOString() ?? null,
    retentionDays: keepForever ? 'forever' : days,
    warnedAdmins,
    contactSubmissionsDeleted: contacts.count,
  })
}
