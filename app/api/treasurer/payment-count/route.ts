import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { getNotificationsSeen, paymentsCountFrom } from '@/lib/notification-seen'

export const dynamic = 'force-dynamic'

export async function GET() {
  const profile = await getSessionProfile()
  const seesPayments =
    profile &&
    (['TREASURER', 'ADMIN'].includes(profile.role) || profile.isSuperAdmin || (profile.dashboardAccess ?? []).includes('TREASURER'))
  if (!profile || !seesPayments) {
    return NextResponse.json({ count: 0 })
  }

  // MPESA_STK_SUCCESS events from the last 24 hours, minus any already marked as read.
  const seen = await getNotificationsSeen(profile.id)
  const since = paymentsCountFrom(seen)
  const count = await prisma.auditLog.count({
    where: { action: 'MPESA_STK_SUCCESS', createdAt: { gt: since }, id: { notIn: seen.paymentIds ?? [] } },
  })

  return NextResponse.json({ count })
}
