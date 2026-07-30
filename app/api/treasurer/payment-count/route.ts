import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const profile = await getSessionProfile()
  if (!profile || !['TREASURER', 'ADMIN'].includes(profile.role)) {
    return NextResponse.json({ count: 0 })
  }

  // Count MPESA_STK_SUCCESS events from the last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const count = await prisma.auditLog.count({
    where: { action: 'MPESA_STK_SUCCESS', createdAt: { gte: since } },
  })

  return NextResponse.json({ count })
}
