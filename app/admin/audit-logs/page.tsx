import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import AuditLogsTable from '@/components/admin/AuditLogsTable'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { requireAdmin } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { resolveAuditTargets, targetKey } from '@/lib/audit-resolve'

export const metadata = {
  title: 'Activity logs',
}

export default async function AdminAuditLogsPage() {
  try {
    await requireAdmin()
  } catch {
    redirect('/admin')
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { user: { select: { fullName: true, email: true } } },
  })

  const targets = await resolveAuditTargets(logs)

  return (
    <DashboardShell role="ADMIN" title="Activity logs" nav={ADMIN_NAV}>
      <div className="mb-4 flex justify-end"><a href="/api/export/audit" className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Export audit CSV</a></div>
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
            createdAt: row.createdAt.toISOString(),
            user: row.user,
            targetKind: resolved?.kind ?? row.entity ?? '—',
            targetLabel: resolved?.label ?? (row.entity ? `${row.entity} (removed)` : '—'),
            targetSubtitle: resolved?.subtitle ?? null,
          }
        })}
      />
    </DashboardShell>
  )
}
