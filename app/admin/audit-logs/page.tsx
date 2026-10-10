import DashboardShell from '@/components/dashboard/DashboardShell'
import AuditLogsTable from '@/components/admin/AuditLogsTable'
import RecentLoginsButton from '@/components/admin/RecentLoginsButton'
import PaginationBar from '@/components/ui/PaginationBar'
import { ADMIN_NAV, navForRole } from '@/lib/dashboard/nav'
import { requireActiveRole } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { resolveAuditTargets, targetKey } from '@/lib/audit-resolve'
import { parsePage, paginationSkip, totalPages } from '@/lib/pagination'
import type { Role } from '@/lib/auth/types'

export const metadata = {
  title: 'Activity logs',
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string
    to?: string
    page?: string
    flagged?: string
  }>
}) {
  const actor = await requireActiveRole(['ADMIN', 'AUDITOR'])
  const role = (actor.isSuperAdmin ? 'ADMIN' : actor.role) as Role
  const nav = role === 'ADMIN' ? ADMIN_NAV : navForRole(role)

  const { from = '', to = '', page: pageRaw, flagged = '' } = await searchParams
  const onlyFlagged = flagged === '1'
  const page = parsePage(pageRaw)
  const pageSize = 50
  const createdAt =
    from || to
      ? {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
        }
      : undefined

  const where = {
    ...(createdAt ? { createdAt } : {}),
    ...(onlyFlagged ? { outsideRole: true } : {}),
  }

  const [total, logs, loginEvents, flaggedCount] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: paginationSkip(page, pageSize),
      take: pageSize,
      include: { user: { select: { fullName: true, email: true } } },
    }),
    prisma.loginEvent.findMany({
      where: { success: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, email: true, createdAt: true, user: { select: { email: true } } },
    }),
    prisma.auditLog.count({ where: { ...(createdAt ? { createdAt } : {}), outsideRole: true } }),
  ])

  const targets = await resolveAuditTargets(logs)
  const exportQs = new URLSearchParams()
  if (from) exportQs.set('from', from)
  if (to) exportQs.set('to', to)
  const exportHref = `/api/export/audit${exportQs.toString() ? `?${exportQs}` : ''}`
  const pages = totalPages(total, pageSize)

  return (
    <DashboardShell
      role={role}
      title="Activity logs"
      nav={nav}
      pageAction={
        <RecentLoginsButton
          logins={loginEvents.map((event) => ({
            id: event.id,
            email: event.user?.email ?? event.email,
            at: event.createdAt.toISOString(),
          }))}
        />
      }
    >
      <div className="mb-4 space-y-3">
        <form className="grid gap-2 rounded-2xl border bg-surface p-4 md:grid-cols-3">
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {onlyFlagged && <input type="hidden" name="flagged" value="1" />}
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">
              Filter
            </button>
            <a href={exportHref} className="rounded-full border px-4 py-2 text-sm text-primary">
              Export CSV
            </a>
          </div>
        </form>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-on-surface-variant">{total} matching log(s)</p>
          <a
            href={`/admin/audit-logs?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(onlyFlagged ? {} : { flagged: '1' }) })}`}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
              onlyFlagged ? 'bg-red-600 text-white' : 'border border-red-300 text-red-700 hover:bg-red-50'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">warning</span>
            {onlyFlagged ? 'Showing only outside-role changes — show all' : `Outside-role changes (${flaggedCount})`}
          </a>
        </div>
      </div>

      <AuditLogsTable
        logs={logs.map((row) => {
          const key = targetKey(row.entity, row.entityId)
          const resolved = key ? targets.get(key) : undefined
          return {
            id: row.id,
            action: row.action,
            entity: row.entity,
            entityId: row.entityId,
            meta: row.meta,
            oldValue: row.oldValue,
            newValue: row.newValue,
            reason: row.reason,
            ipAddress: row.ipAddress,
            userAgent: row.userAgent,
            createdAt: row.createdAt.toISOString(),
            user: row.user,
            targetKind: resolved?.kind ?? row.entity ?? '—',
            targetLabel: resolved?.label ?? (row.entity ? `${row.entity} (removed)` : '—'),
            targetSubtitle: resolved?.subtitle ?? null,
            actorRole: row.actorRole,
            outsideRole: row.outsideRole,
            actorSecondaryRoles: row.actorSecondaryRoles,
            actingRole: row.actingRole,
          }
        })}
      />
      <PaginationBar
        pathname="/admin/audit-logs"
        page={page}
        totalPages={pages}
        params={{ from, to, ...(onlyFlagged ? { flagged: '1' } : {}) }}
      />
    </DashboardShell>
  )
}
