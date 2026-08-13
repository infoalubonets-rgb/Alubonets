import DashboardShell from '@/components/dashboard/DashboardShell'
import MembersTable from '@/components/admin/MembersTable'
import PaginationBar from '@/components/ui/PaginationBar'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import type { Role } from '@/lib/auth/types'
import type { MemberCategory, Prisma } from '@prisma/client'
import Link from 'next/link'
import { parsePage, parsePageSize, paginationSkip, totalPages } from '@/lib/pagination'
import { requireAdmin } from '@/lib/auth/session'

export const metadata = { title: 'Member registry' }

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; q?: string; category?: string; branch?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const page = parsePage(sp.page)
  const pageSize = parsePageSize(sp.pageSize, 25)
  const q = (sp.q || '').trim()
  const category = (sp.category || '').trim()
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
    ...(category || branch
      ? {
          memberProfile: {
            ...(category ? { memberCategory: category as MemberCategory } : {}),
            ...(branch ? { familyBranch: branch } : {}),
          },
        }
      : {}),
  }

  const [total, users, categoryRows, branchRows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      include: { memberProfile: true },
      skip: paginationSkip(page, pageSize),
      take: pageSize,
    }),
    prisma.memberProfile.findMany({
      where: { memberCategory: { not: null } },
      select: { memberCategory: true },
      distinct: ['memberCategory'],
    }),
    prisma.memberProfile.findMany({
      where: { familyBranch: { not: null } },
      select: { familyBranch: true },
      distinct: ['familyBranch'],
    }),
  ])

  const categories = categoryRows.map((f) => f.memberCategory!).filter(Boolean)
  const branches = branchRows.map((f) => f.familyBranch!).filter(Boolean) as string[]
  const pages = totalPages(total, pageSize)

  return (
    <DashboardShell role="ADMIN" title="Member registry" nav={ADMIN_NAV}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 md:px-6">
        <p className="text-sm text-on-surface-variant">View and export the full member registry.</p>
        <Link
          href="/api/export/members"
          className="dashboard-page-action inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-on-primary"
        >
          <span className="material-symbols-outlined text-[17px]">download</span>
          Export full registry
        </Link>
      </div>
      <MembersTable
        users={users.map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          role: u.role as Role,
          status: u.status,
          isSuperAdmin: u.isSuperAdmin,
          isPrincipal: u.isPrincipal,
          phone: u.phone,
          location: u.location,
          membershipNumber: u.membershipNumber,
          memberCategory: u.memberProfile?.memberCategory ?? null,
          familyBranch: u.memberProfile?.familyBranch ?? null,
        }))}
        categories={categories}
        branches={branches}
        filters={{ q, category, branch }}
        total={total}
      />
      <div className="px-4 md:px-6">
        <PaginationBar
          pathname="/admin/members"
          page={page}
          totalPages={pages}
          params={{ q, category, branch }}
        />
      </div>
    </DashboardShell>
  )
}
