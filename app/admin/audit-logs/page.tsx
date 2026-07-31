import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import AuditLogsTable from '@/components/admin/AuditLogsTable'
import PaginationBar from '@/components/ui/PaginationBar'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { requireAdmin } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { resolveAuditTargets, targetKey } from '@/lib/audit-resolve'
import { parsePage, paginationSkip, totalPages } from '@/lib/pagination'

export const metadata = {
  title: 'Activity logs',
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string
    entity?: string
    from?: string
    to?: string
    page?: string
  }>
}) {
  try {
    await requireAdmin()
  } catch {
    redirect('/admin')
  }

  const { action = '', entity = '', from = '', to = '', page: pageRaw } = await searchParams
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
    ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
    ...(entity ? { entity: { contains: entity, mode: 'insensitive' as const } } : {}),
    ...(createdAt ? { createdAt } : {}),
  }

  const [total, logs, loginEvents] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: paginationSkip(page, pageSize),
      take: pageSize,
      include: { user: { select: { fullName: true, email: true } } },
    }),
    prisma.loginEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { user: { select: { fullName: true, email: true } } },
    }),
  ])

  const targets = await resolveAuditTargets(logs)
  const exportQs = new URLSearchParams()
  if (action) exportQs.set('action', action)
  if (entity) exportQs.set('entity', entity)
  if (from) exportQs.set('from', from)
  if (to) exportQs.set('to', to)
  const exportHref = `/api/export/audit${exportQs.toString() ? `?${exportQs}` : ''}`
  const pages = totalPages(total, pageSize)

  return (
    <DashboardShell role="ADMIN" title="Activity logs" nav={ADMIN_NAV}>
      <div className="mb-4 space-y-3">
        <form className="grid gap-2 rounded-2xl border bg-surface p-4 md:grid-cols-5">
          <input
            name="action"
            defaultValue={action}
            placeholder="Action contains…"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            name="entity"
            defaultValue={entity}
            placeholder="Entity contains…"
            className="rounded-lg border px-3 py-2 text-sm"
          />
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
            <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">
              Filter
            </button>
            <a href={exportHref} className="rounded-full border px-4 py-2 text-sm text-primary">
              Export CSV
            </a>
          </div>
        </form>
        <p className="text-xs text-on-surface-variant">{total} matching log(s)</p>
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
          }
        })}
      />
      <PaginationBar
        pathname="/admin/audit-logs"
        page={page}
        totalPages={pages}
        params={{ action, entity, from, to }}
      />

      <section className="mt-8 rounded-2xl border bg-surface p-5">
        <h2 className="font-h3 text-xl text-primary">Recent login events</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Stored in LoginEvent (separate from AuditLog) for authentication history.
        </p>
        <ul className="mt-3 divide-y text-sm">
          {loginEvents.map((event) => (
            <li key={event.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                <b>{event.user?.fullName ?? event.email}</b>
                {' · '}
                {event.success ? 'Success' : `Failed${event.reason ? ` (${event.reason})` : ''}`}
              </span>
              <span className="text-on-surface-variant">
                {event.createdAt.toLocaleString()}
                {event.ipAddress ? ` · ${event.ipAddress}` : ''}
              </span>
            </li>
          ))}
          {!loginEvents.length && <li className="py-2">No login events yet.</li>}
        </ul>
      </section>
    </DashboardShell>
  )
}
