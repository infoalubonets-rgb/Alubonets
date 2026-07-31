import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Retention purge (NOT backups — Supabase owns DB backups):
 * DELETE audit_logs older than AppSetting audit_retention_days (fallback 365).
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

  const retentionSetting = await prisma.appSetting.findUnique({
    where: { key: 'audit_retention_days' },
  })
  const days = Number(retentionSetting?.value || process.env.AUDIT_RETENTION_DAYS || 365)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - (Number.isFinite(days) && days > 0 ? days : 365))

  const deleted = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`
    return tx.$executeRaw`DELETE FROM "audit_logs" WHERE "createdAt" < ${cutoff}`
  })

  const contacts = await prisma.contactSubmission.deleteMany({
    where: { retainUntil: { lte: new Date() }, status: { in: ['RESOLVED', 'SPAM'] } },
  })

  return NextResponse.json({
    ok: true,
    deleted: Number(deleted),
    cutoff: cutoff.toISOString(),
    retentionDays: days,
    contactSubmissionsDeleted: contacts.count,
  })
}
