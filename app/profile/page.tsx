import { redirect } from 'next/navigation'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { initialsFromName } from '@/lib/auth/helpers'
import ProfileView from '@/components/profile/ProfileView'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { navForRole } from '@/lib/dashboard/nav'
import type { Role } from '@/lib/auth/types'
import AccountSecurity from '@/components/profile/AccountSecurity'
import PrivilegedMfaPanel from '@/components/profile/PrivilegedMfaPanel'
import MemberDetailsForm from '@/components/profile/MemberDetailsForm'
import PublicProfileFieldsForm from '@/components/profile/PublicProfileFieldsForm'
import { createServerClient } from '@/lib/supabase-server'
import { PRIVILEGED_MFA_ROLES } from '@/lib/mfa-totp'

export const metadata = {
  title: 'My profile',
}

export default async function ProfilePage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login?next=/profile')

  if (profile.status === 'SUSPENDED') {
    redirect('/login?error=suspended')
  }

  const [agg, welfareCount] = await Promise.all([
    prisma.contribution.aggregate({
      where: { userId: profile.id, status: { in: ['CONFIRMED','RECONCILED'] } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.welfareRequest.count({ where: { userId: profile.id } }),
  ])

  const user = await prisma.user.findUnique({ where: { id: profile.id }, include: { memberProfile: true } })
  if (!user) redirect('/login')
  let avatarUrl = user.avatarUrl
  if (avatarUrl && !avatarUrl.startsWith('http')) {
    const signed = await createServerClient().storage.from('member-avatars').createSignedUrl(avatarUrl, 3600)
    avatarUrl = signed.data?.signedUrl ?? null
  }

  const role = user.role as Role

  return (
    <DashboardShell role={role} title="My profile" nav={navForRole(role)}>
      <ProfileView
        data={{
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          location: user.location,
          avatarUrl,
          role,
          status: user.status,
          isSuperAdmin: user.isSuperAdmin,
          initials: initialsFromName(user.fullName),
          contributionCount: agg._count,
          contributionTotal: agg._sum.amount ?? 0,
          welfareCount,
        }}
      />
      <MemberDetailsForm data={{
        phone: user.phone ?? '',
        location: user.location ?? '',
        familyBranch: user.memberProfile?.familyBranch ?? '',
        nextOfKinName: user.memberProfile?.nextOfKinName ?? '',
        nextOfKinPhone: user.memberProfile?.nextOfKinPhone ?? '',
        nextOfKinRelationship: user.memberProfile?.nextOfKinRelationship ?? '',
        profession: user.memberProfile?.profession ?? '',
        skills: user.memberProfile?.skills ?? '',
        achievements: user.memberProfile?.achievements ?? '',
        mentorshipArea: user.memberProfile?.mentorshipArea ?? '',
        interests: user.memberProfile?.interests ?? '',
        emergencyContactName: user.memberProfile?.emergencyContactName ?? '',
        emergencyContactPhone: user.memberProfile?.emergencyContactPhone ?? '',
        educationLevel: user.memberProfile?.educationLevel ?? 'SECONDARY',
      }} />
      <div className="mx-auto mt-4 max-w-lg pb-12">
        <PublicProfileFieldsForm initial={user.publicProfileFields} />
        <AccountSecurity />
        <PrivilegedMfaPanel
          enabled={user.mfaEnabled}
          canManage={PRIVILEGED_MFA_ROLES.includes(user.role as (typeof PRIVILEGED_MFA_ROLES)[number]) || user.isSuperAdmin}
        />
      </div>
    </DashboardShell>
  )
}
