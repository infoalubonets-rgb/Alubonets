import DashboardUserProvider from '@/components/dashboard/DashboardUserProvider'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { navForRole } from '@/lib/dashboard/nav'
import { requireSessionProfile, getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { getRoleAlerts } from '@/lib/role-alerts'
import { ROLE_LABEL, type Role } from '@/lib/auth/types'
import { getNotificationsSeen, paymentsCountFrom, unseenAlertCount } from '@/lib/notification-seen'
import { ClearReadButton, MarkAllReadButton } from '@/components/dashboard/NotificationActions'
import NotificationsList, { type NotificationItem } from '@/components/dashboard/NotificationsList'
import { announcementAudienceWhere, noticeAudienceWhere } from '@/lib/notification-audience'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications — Alubonets' }

const formatDate = (date: Date) =>
  date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default async function NotificationsPage() {
  const actor = await requireSessionProfile()
  const role = actor.role as Role
  const [alerts, notices, announcements, seen] = await Promise.all([
    getRoleAlerts({ id: actor.id, role, isSuperAdmin: actor.isSuperAdmin, dashboardAccess: actor.dashboardAccess as Role[] }),
    // Only notices for the selected workspace (Admin sees all; personal/general notices show everywhere).
    prisma.userNotification.findMany({ where: { userId: actor.id, ...noticeAudienceWhere(role) }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.announcementReceipt.findMany({
      where: { userId: actor.id, announcement: { status: 'SENT', ...announcementAudienceWhere(role) } },
      include: {
        announcement: {
          select: { id: true, title: true, content: true, imageUrl: true, publishedAt: true, author: { select: { fullName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    getNotificationsSeen(actor.id),
  ])
  const seesPayments =
    role === 'ADMIN' || role === 'TREASURER' || actor.isSuperAdmin || (actor.dashboardAccess ?? []).includes('TREASURER')
  const paymentsFrom = paymentsCountFrom(seen)
  const recentPayments = seesPayments
    ? await prisma.auditLog.findMany({
        where: { action: 'MPESA_STK_SUCCESS', createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    : []
  const readPaymentIds = new Set(seen.paymentIds ?? [])
  const paymentUnread = (payment: { id: string; createdAt: Date }) => payment.createdAt > paymentsFrom && !readPaymentIds.has(payment.id)
  const unseenPayments = recentPayments.filter(paymentUnread).length

  const unreadCount = notices.filter((notice) => !notice.readAt).length
  const readCount = notices.length - unreadCount
  // Anything still lighting up the header bell — "Mark all as read" clears all of it.
  const bellCount = unreadCount + unseenAlertCount(alerts, seen) + unseenPayments + announcements.filter((receipt) => !receipt.readAt).length

  const todos: NotificationItem[] = alerts.map((alert) => ({
    id: alert.key,
    kind: 'todo',
    group: alert.informational ? 'notification' : 'todo',
    icon: alert.icon,
    title: alert.title,
    summary: `${alert.description} (${alert.count}). Open the page to deal with ${alert.count === 1 ? 'it' : 'them'}.`,
    date: null,
    unread: alert.count > (seen.alerts[alert.key] ?? 0),
    href: alert.href,
    openLabel: `Go to ${alert.title.toLowerCase()}`,
    count: alert.count,
    details: [
      { label: 'Waiting', value: String(alert.count) },
      { label: 'Handled from', value: `${ROLE_LABEL[alert.role]} dashboard` },
    ],
  }))

  const dated = [
    ...recentPayments.map((payment) => {
      const meta = (payment.meta ?? {}) as { amount?: number; receipt?: string; phone?: string }
      const amount = `KES ${Math.round(meta.amount ?? 0).toLocaleString()}`
      const from = payment.user?.fullName ?? 'a member'
      return {
        at: payment.createdAt,
        item: {
          id: payment.id,
          kind: 'payment',
          group: 'notification',
          icon: 'payments',
          title: `${amount} from ${from}`,
          summary: meta.receipt ? `M-Pesa receipt ${meta.receipt}` : 'M-Pesa payment',
          date: formatDate(payment.createdAt),
          unread: paymentUnread(payment),
          href: '/dashboard/treasurer/contributions',
          details: [
            { label: 'Amount', value: amount },
            { label: 'From', value: from },
            ...(meta.receipt ? [{ label: 'Receipt', value: meta.receipt }] : []),
            ...(meta.phone ? [{ label: 'Phone', value: meta.phone }] : []),
            { label: 'Received', value: formatDate(payment.createdAt) },
          ],
        } satisfies NotificationItem,
      }
    }),
    ...announcements.map(({ announcement, readAt }) => ({
      at: announcement.publishedAt,
      item: {
        id: announcement.id,
        kind: 'announcement',
        group: 'notification',
        icon: 'notifications',
        title: announcement.title,
        summary: announcement.content,
        date: formatDate(announcement.publishedAt),
        unread: !readAt,
        href: null,
        imageUrl: announcement.imageUrl,
        details: [
          { label: 'From', value: announcement.author?.fullName ?? 'Alubonets' },
          { label: 'Published', value: formatDate(announcement.publishedAt) },
        ],
      } satisfies NotificationItem,
    })),
    ...notices.map((notice) => ({
      at: notice.createdAt,
      item: {
        id: notice.id,
        kind: 'message',
        group: 'notification',
        icon: 'notifications',
        title: notice.title,
        summary: notice.body || 'No further details.',
        date: formatDate(notice.createdAt),
        unread: !notice.readAt,
        href: notice.href,
        details: [
          { label: 'Received', value: formatDate(notice.createdAt) },
          ...(notice.readAt ? [{ label: 'Read', value: formatDate(notice.readAt) }] : []),
        ],
      } satisfies NotificationItem,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .map((entry) => entry.item)

  return (
    <DashboardUserProvider user={await getSessionUser()}>
    <DashboardShell
      role={role}
      title="Notifications"
      nav={navForRole(role)}
      pageAction={
        <span className="flex items-center gap-2">
          {readCount > 0 && <ClearReadButton readCount={readCount} />}
          <MarkAllReadButton unreadCount={bellCount} />
        </span>
      }
    >
      <NotificationsList items={[...todos, ...dated]} />
    </DashboardShell>
    </DashboardUserProvider>
  )
}
