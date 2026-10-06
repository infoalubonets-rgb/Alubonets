import DashboardShell from '@/components/dashboard/DashboardShell'
import MyFamilyPage from '@/components/dashboard/MyFamilyPage'
import FamilyAdministrationClient, { FamilyAdministrationActions, FamilyAdministrationFilterSlot } from '@/components/admin/FamilyAdministrationClient'
import { requireAdmin } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'

const relationshipLabel: Record<string, string> = {
  SPOUSE: 'Spouse', SON: 'Son', DAUGHTER: 'Daughter', CHILD: 'Child', DEPENDENT: 'Dependent', OTHER: 'Other',
}

export default async function AdminFamilyPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireAdmin()
  if ((await searchParams).view === 'mine') return <MyFamilyPage adminWorkspace />
  const members = await prisma.user.findMany({
    where: { status: { in: ['ACTIVE', 'PENDING', 'INACTIVE'] } },
    orderBy: { fullName: 'asc' }, take: 500,
    select: { id: true, fullName: true, email: true, phone: true, status: true, isPrincipal: true, principalMemberId: true, familyRelationship: true, principal: { select: { fullName: true } } },
  })
  const principals = members.filter(member => member.isPrincipal && member.status === 'ACTIVE').map(member => ({ id: member.id, fullName: member.fullName }))
  return <DashboardShell role="ADMIN" title="Family" nav={navForRole('ADMIN')} hideRelatedLinks pageAction={<FamilyAdministrationActions />} pageCenter={<FamilyAdministrationFilterSlot />}>
    <FamilyAdministrationClient members={members.map(member => ({
      id: member.id, fullName: member.fullName, email: member.email, phone: member.phone,
      status: member.status, isPrincipal: member.isPrincipal, principalMemberId: member.principalMemberId,
      relationship: member.familyRelationship ? relationshipLabel[member.familyRelationship] || member.familyRelationship : null,
      principalName: member.principal?.fullName || null,
    }))} principals={principals} />
  </DashboardShell>
}
