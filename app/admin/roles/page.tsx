import DashboardShell from '@/components/dashboard/DashboardShell'
import RolesAccessForm from '@/components/admin/RolesAccessForm'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import type { Role } from '@/lib/auth/types'
import { requireAdmin } from '@/lib/auth/session'

export default async function AdminRolesPage() {
  // Only Admin and Super Admin may manage roles & dashboard access.
  const actor = await requireAdmin()

  const users = await prisma.user.findMany({
    where: { status: { in: ['ACTIVE', 'PENDING', 'SUSPENDED'] } },
    orderBy: { fullName: 'asc' },
  })

  return (
    <DashboardShell role="ADMIN" title="Roles & access" nav={ADMIN_NAV}>
      <RolesAccessForm
        actorIsSuperAdmin={!!actor.isSuperAdmin}
        actorId={actor.id}
        users={users.map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          role: u.role as Role,
          isSuperAdmin: u.isSuperAdmin,
          dashboardAccess: (Array.isArray(u.dashboardAccess) ? u.dashboardAccess : []) as Role[],
        }))}
      />
    </DashboardShell>
  )
}
