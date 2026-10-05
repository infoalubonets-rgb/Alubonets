import DashboardShell from '@/components/dashboard/DashboardShell'
import MembersTable from '@/components/admin/MembersTable'
import PaginationBar from '@/components/ui/PaginationBar'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { ALL_ROLES, ROLE_LABEL, type Role } from '@/lib/auth/types'
import type { Prisma } from '@prisma/client'
import { parsePage, parsePageSize, paginationSkip, totalPages } from '@/lib/pagination'
import { requireAdmin } from '@/lib/auth/session'
import { isDependent } from '@/lib/membership-standing'

export const metadata = { title: 'Accounts' }

const SUPER_ADMIN_FILTER = 'SUPER_ADMIN'

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string; branch?: string; role?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const page = parsePage(sp.page)
  const pageSize = parsePageSize(sp.pageSize, 25)
  const q = (sp.q || '').trim()
  const branch = (sp.branch || '').trim()
  const requestedRole = (sp.role || '').trim()
  const roleFilter =
    requestedRole === SUPER_ADMIN_FILTER || ALL_ROLES.includes(requestedRole as Role) ? requestedRole : ''

  // Super Admins get their own tab, so the per-role tabs leave them out.
  const roleWhere: Prisma.UserWhereInput = !roleFilter
    ? {}
    : roleFilter === SUPER_ADMIN_FILTER
      ? { isSuperAdmin: true }
      : { role: roleFilter as Role, isSuperAdmin: false }

  const where: Prisma.UserWhereInput = {
    ...roleWhere,
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { membershipNumber: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(branch ? { memberProfile: { familyBranch: branch } } : {}),
  }

  const [total, users, branchRows, managedBranches, roleCounts, superAdminCount, allCount, pendingApprovals] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      include: { memberProfile: true, principal: { select: { fullName: true } } },
      skip: paginationSkip(page, pageSize),
      take: pageSize,
    }),
    prisma.memberProfile.findMany({
      where: { familyBranch: { not: null } },
      select: { familyBranch: true },
      distinct: ['familyBranch'],
    }),
    prisma.appSetting.findUnique({ where: { key: 'branch_lineages' } }),
    prisma.user.groupBy({ by: ['role'], where: { isSuperAdmin: false }, _count: true }),
    prisma.user.count({ where: { isSuperAdmin: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { status: 'PENDING', rejectedAt: null } }),
  ])

  const savedBranches: string[] = managedBranches ? JSON.parse(managedBranches.value) : []
  const branches = Array.from(new Set(['Default', 'Unassigned', ...savedBranches, ...branchRows.map((f) => f.familyBranch!).filter(Boolean)])) as string[]
  const pages = totalPages(total, pageSize)
  const countByRole = new Map(roleCounts.map((row) => [row.role as Role, row._count]))
  const roleTabs = [
    { value: '', label: 'All', count: allCount },
    { value: SUPER_ADMIN_FILTER, label: 'Super Admin', count: superAdminCount },
    ...ALL_ROLES.map((role) => ({
      value: role,
      label: role === 'ADMIN' ? 'Admins' : ROLE_LABEL[role],
      count: countByRole.get(role) ?? 0,
    })),
  ]

  return (
    <DashboardShell role="ADMIN" title="Accounts" nav={ADMIN_NAV} hidePageHeading>
      <MembersTable
        users={users.map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          role: u.role as Role,
          status: u.status,
          isSuperAdmin: u.isSuperAdmin,
          isPrincipal: u.isPrincipal,
          principalName: u.principal?.fullName ?? null,
          phone: u.phone,
          location: u.location,
          membershipNumber: u.membershipNumber,
          memberCategory: u.memberProfile?.memberCategory ?? null,
          familyBranch: u.memberProfile?.familyBranch ?? null,
          standing: u.standing,
          standingReason: u.standingReason,
          standingOverride: u.standingOverride,
          standingOverrideUntil: u.standingOverrideUntil?.toISOString() ?? null,
          contributionExempt: u.contributionExempt,
          isMinor: isDependent({ contributionExempt: false, dateOfBirth: u.memberProfile?.dateOfBirth ?? null }),
        }))}
        branches={branches}
        filters={{ q, branch, role: roleFilter }}
        roleTabs={roleTabs}
        pendingApprovals={pendingApprovals}
      />
      <div className="px-4 md:px-6">
        <PaginationBar
          pathname="/admin/accounts"
          page={page}
          totalPages={pages}
          params={{ q, branch, role: roleFilter }}
        />
      </div>
    </DashboardShell>
  )
}
