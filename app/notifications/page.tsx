import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { navForRole } from '@/lib/dashboard/nav'
import { requireSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { getRoleAlerts, type RoleAlert } from '@/lib/role-alerts'
import { ROLE_LABEL, type Role } from '@/lib/auth/types'
import { markNotificationsRead } from '@/app/actions/notifications'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications — Alubonets' }

export default async function NotificationsPage() {
  const actor = await requireSessionProfile()
  const role = actor.role as Role
  const [alerts, notices] = await Promise.all([
    getRoleAlerts({ id: actor.id, role, isSuperAdmin: actor.isSuperAdmin, dashboardAccess: actor.dashboardAccess as Role[] }),
    prisma.userNotification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ])

  const alertsByRole = alerts.reduce<Map<Role, RoleAlert[]>>((groups, alert) => {
    groups.set(alert.role, [...(groups.get(alert.role) ?? []), alert])
    return groups
  }, new Map())
  const unreadCount = notices.filter((notice) => !notice.readAt).length

  return (
    <DashboardShell role={role} title="Notifications" nav={navForRole(role)}>
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="space-y-3">
          <h2 className="font-semibold text-on-surface">Needs your attention</h2>
          {alerts.length === 0 ? (
            <p className="rounded-2xl border border-outline-variant bg-surface p-5 text-sm text-on-surface-variant">
              Nothing is waiting on you right now.
            </p>
          ) : (
            [...alertsByRole].map(([alertRole, roleAlerts]) => (
              <div key={alertRole} className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{ROLE_LABEL[alertRole]}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {roleAlerts.map((alert) => (
                    <Link
                      key={alert.key}
                      href={alert.href}
                      className="group flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface p-4 transition hover:border-primary/40 hover:shadow-md"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container/15 text-secondary">
                        <span className="material-symbols-outlined icon-fill text-[20px]">{alert.icon}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-on-surface">{alert.title}</span>
                        <span className="block truncate text-xs text-on-surface-variant">{alert.description}</span>
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-white">{alert.count}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-on-surface">Your notifications</h2>
            {unreadCount > 0 && (
              <form action={async () => { 'use server'; await markNotificationsRead() }}>
                <button className="text-xs font-semibold text-primary hover:underline">Mark all as read ({unreadCount})</button>
              </form>
            )}
          </div>
          {notices.length === 0 ? (
            <p className="rounded-2xl border border-outline-variant bg-surface p-5 text-sm text-on-surface-variant">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-outline-variant overflow-hidden rounded-2xl border border-outline-variant bg-surface">
              {notices.map((notice) => (
                <li key={notice.id} className={notice.readAt ? '' : 'bg-primary/[0.04]'}>
                  <Link href={notice.href || '#'} className="flex items-start gap-3 px-4 py-3 hover:bg-primary/[0.03]">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notice.readAt ? 'bg-transparent' : 'bg-secondary'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-on-surface">{notice.title}</span>
                      {notice.body && <span className="block text-xs text-on-surface-variant">{notice.body}</span>}
                    </span>
                    <span className="shrink-0 text-[11px] text-outline">
                      {notice.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardShell>
  )
}
