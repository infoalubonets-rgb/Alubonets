import { redirect } from 'next/navigation'
import { missingProfileDetails, needsProfileCompletion } from '@/lib/profile-completion'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { initialsFromName } from '@/lib/auth/helpers'
import { familyTag } from '@/lib/family-tags'
import { ensureMembershipNumber } from '@/lib/member-id-assign'
import ProfileView from '@/components/profile/ProfileView'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { navForRole } from '@/lib/dashboard/nav'
import type { Role } from '@/lib/auth/types'
import AccountSecurity from '@/components/profile/AccountSecurity'
import MemberDetailsForm from '@/components/profile/MemberDetailsForm'
import { createServerClient } from '@/lib/supabase-server'
import { isExecutive } from '@/lib/directory'
import ExecutiveDetailsForm from '@/components/profile/ExecutiveDetailsForm'

export const metadata = {
  title: 'My profile',
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ complete?: string }> }) {
  const { complete } = await searchParams
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

  const user = await prisma.user.findUnique({
    where: { id: profile.id },
    include: { memberProfile: true, principal: { select: { familyCode: true } } },
  })
  if (!user) redirect('/login')
  const executive = isExecutive(user)
  const aboutProfile = executive ? await prisma.committeeProfile.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' } }) : null
  let avatarUrl = user.avatarUrl
  if (avatarUrl && !avatarUrl.startsWith('http')) {
    const signed = await createServerClient().storage.from('member-avatars').createSignedUrl(avatarUrl, 3600)
    avatarUrl = signed.data?.signedUrl ?? null
  }

  const role = profile.role as Role
  // New admin-created accounts land here to fill in what the administrator left out.
  const missing = missingProfileDetails(user)
  const showCompletion = missing.length > 0 && (complete === '1' || needsProfileCompletion(user))

  return (
    <DashboardShell role={role} title="My profile" nav={navForRole(role)}>
      {showCompletion && (
        <section role="status" className="mx-auto mb-4 max-w-3xl rounded-2xl border border-secondary-container/50 bg-secondary-container/10 p-4">
          <p className="flex items-center gap-2 font-semibold text-primary">
            <span className="material-symbols-outlined text-[20px] text-secondary">badge</span>
            Welcome! Please complete your profile
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Your account was set up by an administrator. Fill in the details below so the group has your full record: {missing.join(', ')}.
          </p>
        </section>
      )}
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
          memberId: await ensureMembershipNumber(user),
          familyTag: familyTag(user),
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
      {executive && <ExecutiveDetailsForm position={user.aboutTitle ?? ''} biography={aboutProfile?.biography ?? ''} responsibilities={aboutProfile?.responsibilities ?? ''} />}
      <div className="mx-auto mt-4 max-w-lg pb-12">
        <AccountSecurity />
      </div>
    </DashboardShell>
  )
}
