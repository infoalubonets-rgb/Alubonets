import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { getRoleAlerts } from '@/lib/role-alerts'
import type { Role } from '@/lib/auth/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const profile = await getSessionProfile()
    if (!profile) return NextResponse.json({ count: 0 }, { status: 401 })
    const [alerts, unreadNotices] = await Promise.all([
      getRoleAlerts({ id: profile.id, role: profile.role as Role, isSuperAdmin: profile.isSuperAdmin, dashboardAccess: profile.dashboardAccess as Role[] }),
      prisma.userNotification.count({ where: { userId: profile.id, readAt: null } }),
    ])
    return NextResponse.json({ count: alerts.reduce((sum, alert) => sum + alert.count, 0) + unreadNotices })
  } catch (err) {
    console.error('[/api/notifications/count]', err)
    return NextResponse.json({ count: 0 })
  }
}
