import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { getRoleAlerts } from '@/lib/role-alerts'
import { getNotificationsSeen, unseenAlertCount } from '@/lib/notification-seen'
import type { Role } from '@/lib/auth/types'
import { announcementAudienceWhere, noticeAudienceWhere } from '@/lib/notification-audience'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const profile = await getSessionProfile()
    if (!profile) return NextResponse.json({ count: 0 }, { status: 401 })
    const [alerts, unreadNotices, unreadAnnouncements, seen] = await Promise.all([
      getRoleAlerts({ id: profile.id, role: profile.role as Role, isSuperAdmin: profile.isSuperAdmin, dashboardAccess: profile.dashboardAccess as Role[] }),
      prisma.userNotification.count({ where: { userId: profile.id, readAt: null, ...noticeAudienceWhere(profile.role as Role) } }),
      prisma.announcementReceipt.count({ where: { userId: profile.id, readAt: null, announcement: announcementAudienceWhere(profile.role as Role) } }),
      getNotificationsSeen(profile.id),
    ])
    // To-dos already marked as read stop counting until new ones arrive.
    return NextResponse.json({ count: unseenAlertCount(alerts, seen) + unreadNotices + unreadAnnouncements })
  } catch (err) {
    console.error('[/api/notifications/count]', err)
    return NextResponse.json({ count: 0 })
  }
}
