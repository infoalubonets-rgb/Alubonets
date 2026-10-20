import DashboardShell from '@/components/dashboard/DashboardShell'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import ApprovalsTable, { type ApprovalApplicant } from '@/components/admin/ApprovalsTable'
import { requireAdmin } from '@/lib/auth/session'
import { assignableRoles, getDisabledRoles } from '@/lib/disabled-roles'
import { ROLE_LABEL } from '@/lib/auth/types'

export default async function AdminApprovalsPage() {
  // Only Admin / Super Admin may view applicant PII or approve/assign a Principal Member.
  const actor = await requireAdmin()
  const roleOptions = assignableRoles(await getDisabledRoles())
    .filter((role) => role !== 'ADMIN' || actor.isSuperAdmin)
    .map((role) => ({ value: role, label: ROLE_LABEL[role] }))
  const [pending, principals] = await Promise.all([prisma.user.findMany({
    where: {
      status: 'PENDING',
      rejectedAt: null,
      // Signed in (e.g. with Google) but never submitted the application: nothing to review yet.
      NOT: { AND: [{ authUserId: { not: null } }, { consentRecords: { none: {} } }] },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      memberProfile: true,
      consentRecords: { orderBy: { acceptedAt: 'desc' }, take: 1 },
    },
  }), prisma.user.findMany({
    where: { isPrincipal: true, status: 'ACTIVE', principalMemberId: null },
    select: { id: true, fullName: true, membershipNumber: true },
    orderBy: { fullName: 'asc' },
  })])

  const applicants: ApprovalApplicant[] = pending.map((user) => {
    const profile = user.memberProfile
    const consent = user.consentRecords[0]
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt.toISOString(),
      consentSummary: consent ? `${consent.termsVersion}, accepted ${consent.acceptedAt.toLocaleString()}` : null,
      hasPrincipalLink: Boolean(user.principalMemberId || user.isPrincipal),
      fields: profile
        ? [
            ['Gender', profile.gender],
            ['Date of birth', profile.dateOfBirth?.toLocaleDateString()],
            ['Address', profile.address],
            ['Member category', profile.memberCategory?.replaceAll('_', ' ')],
            ['Next of kin', `${profile.nextOfKinName} · ${profile.nextOfKinPhone} · ${profile.nextOfKinRelationship}`],
            ['Emergency contact', `${profile.emergencyContactName} · ${profile.emergencyContactPhone}`],
            ['Profession', profile.profession],
            ['Education', profile.educationLevel],
            ['Skills', profile.skills],
            ['Achievements', profile.achievements],
            ['Mentorship area', profile.mentorshipArea],
            ['Interests', profile.interests],
          ]
        : [],
    }
  })

  return (
    <DashboardShell role="ADMIN" title="Approvals" nav={ADMIN_NAV}>
      <div className="p-4 md:p-6">
        <ApprovalsTable applicants={applicants} principals={principals} roleOptions={roleOptions} />
      </div>
    </DashboardShell>
  )
}
