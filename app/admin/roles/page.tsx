import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import RolesAccessForm from '@/components/admin/RolesAccessForm'
import RoleCatalogueSettings from '@/components/admin/RoleCatalogueSettings'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import type { Role } from '@/lib/auth/types'
import { requireAdmin } from '@/lib/auth/session'
import { getDisabledRoles } from '@/lib/disabled-roles'

export default async function AdminRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ settings?: string }>
}) {
  const { settings } = await searchParams
  // Only Admin and Super Admin may manage roles & dashboard access.
  const actor = await requireAdmin()
  const disabledRoles = await getDisabledRoles()

  const users = await prisma.user.findMany({
    where: { status: { in: ['ACTIVE', 'PENDING', 'SUSPENDED'] } },
    orderBy: { fullName: 'asc' },
  })

  const holderCounts: Partial<Record<Role, number>> = {}
  for (const u of users) {
    if (u.status !== 'ACTIVE' || u.isSuperAdmin) continue
    const role = u.role as Role
    holderCounts[role] = (holderCounts[role] ?? 0) + 1
  }

  return (
    <DashboardShell
      role="ADMIN"
      title="Roles & access"
      nav={ADMIN_NAV}
      hideRelatedLinks
      pageAction={
        <div className="flex items-center gap-2 sm:justify-end">
          <RoleCatalogueSettings
            disabledRoles={disabledRoles}
            holderCounts={holderCounts}
            defaultOpen={settings === '1'}
          />
          <Link
            href="/admin/settings"
            aria-label="Back to settings"
            title="Back to settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface-variant shadow-sm transition hover:bg-surface-container hover:text-primary active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[22px]">settings</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-5 p-4 md:p-6 max-w-5xl mx-auto">
        <RolesAccessForm
          actorIsSuperAdmin={!!actor.isSuperAdmin}
          actorId={actor.id}
          disabledRoles={disabledRoles}
          users={users.map((u) => ({
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            role: u.role as Role,
            isSuperAdmin: u.isSuperAdmin,
            isPrincipal: u.isPrincipal,
            attachedToPrincipal: Boolean(u.principalMemberId),
            active: u.status === 'ACTIVE',
            dashboardAccess: (Array.isArray(u.dashboardAccess) ? u.dashboardAccess : []) as Role[],
          }))}
        />
      </div>
    </DashboardShell>
  )
}
