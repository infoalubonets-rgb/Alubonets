import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Cron-friendly retention: DELETE audit_logs older than AUDIT_RETENTION_MONTHS (default 18).
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

  const months = Number(process.env.AUDIT_RETENTION_MONTHS || 18)
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)

  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  const contacts = await prisma.contactSubmission.deleteMany({
    where: { retainUntil: { lte: new Date() }, status: { in: ['RESOLVED', 'SPAM'] } },
  })

  return NextResponse.json({
    ok: true,
    deleted: result.count,
    cutoff: cutoff.toISOString(),
    months,
    contactSubmissionsDeleted: contacts.count,
  })
}
