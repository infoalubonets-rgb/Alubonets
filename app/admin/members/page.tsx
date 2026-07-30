import DashboardShell from '@/components/dashboard/DashboardShell'
import MembersTable from '@/components/admin/MembersTable'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import type { Role } from '@/lib/auth/types'
import Link from 'next/link'

export default async function AdminMembersPage() {
  const users = await prisma.user.findMany({
    orderBy: { fullName: 'asc' },
    include: { memberProfile: true },
  })

  return (
    <DashboardShell role="ADMIN" title="Members" nav={ADMIN_NAV}>
      <div className="px-4 pt-4 md:px-6"><Link href="/api/export/members" className="inline-flex rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Export members CSV</Link></div>
      <MembersTable
        users={users.map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          role: u.role as Role,
          status: u.status,
          isSuperAdmin: u.isSuperAdmin,
          phone: u.phone,
          location: u.location,
          membershipNumber: u.membershipNumber,
          memberCategory: u.memberProfile?.memberCategory ?? null,
          familyBranch: u.memberProfile?.familyBranch ?? null,
        }))}
      />
    </DashboardShell>
  )
}
