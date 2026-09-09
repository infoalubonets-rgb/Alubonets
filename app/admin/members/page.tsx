import DashboardShell from '@/components/dashboard/DashboardShell'
import MembersTable from '@/components/admin/MembersTable'
import PaginationBar from '@/components/ui/PaginationBar'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import type { Role } from '@/lib/auth/types'
import type { Prisma } from '@prisma/client'
import { parsePage, parsePageSize, paginationSkip, totalPages } from '@/lib/pagination'
import { requireAdmin } from '@/lib/auth/session'

export const metadata = { title: 'Member registry' }

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string; branch?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const page = parsePage(sp.page)
  const pageSize = parsePageSize(sp.pageSize, 25)
  const q = (sp.q || '').trim()
  const branch = (sp.branch || '').trim()

  const where: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { membershipNumber: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(branch
      ? {
          memberProfile: {
            familyBranch: branch,
          },
        }
      : {}),
  }

  const [total, users, branchRows, managedBranches] = await Promise.all([
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
  ])

  const savedBranches: string[] = managedBranches ? JSON.parse(managedBranches.value) : []
  const branches = Array.from(new Set(['Default', 'Unassigned', ...savedBranches, ...branchRows.map((f) => f.familyBranch!).filter(Boolean)])) as string[]
  const pages = totalPages(total, pageSize)

  return (
    <DashboardShell role="ADMIN" title="Member registry" nav={ADMIN_NAV} hidePageHeading>
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
        }))}
        branches={branches}
        filters={{ q, branch }}
      />
      <div className="px-4 md:px-6">
        <PaginationBar
          pathname="/admin/members"
          page={page}
          totalPages={pages}
          params={{ q, branch }}
        />
      </div>
    </DashboardShell>
  )
}
