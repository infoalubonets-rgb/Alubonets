import DashboardShell from '@/components/dashboard/DashboardShell'
import FamilyBranchClient from '@/components/dashboard/FamilyBranchClient'
import BranchPaymentsPanel from '@/components/dashboard/BranchPaymentsPanel'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { ageOn } from '@/lib/profile-privacy'

const RELATIONSHIP_LABEL: Record<string, string> = {
  SPOUSE: 'Spouse',
  SON: 'Son',
  DAUGHTER: 'Daughter',
  CHILD: 'Child',
  DEPENDENT: 'Dependent',
  OTHER: 'Other',
}

const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')

function fullDetails(m: {
  membershipNumber: string | null
  location: string | null
  standing: string
  contributionExempt: boolean
  approvedAt: Date | null
  createdAt: Date
  memberProfile: {
    dateOfBirth: Date | null
    gender: string | null
    profession: string | null
    educationLevel: string | null
    familyBranch: string | null
    emergencyContactName: string | null
    emergencyContactPhone: string | null
    address: string | null
    nextOfKinName: string | null
    nextOfKinPhone: string | null
    nextOfKinRelationship: string | null
    skills: string | null
    achievements: string | null
    mentorshipArea: string | null
    interests: string | null
    memberCategory: string | null
  } | null
}): [string, string][] {
  const profile = m.memberProfile
  const dob = profile?.dateOfBirth
  const rows: [string, string | null | undefined][] = [
    ['Membership number', m.membershipNumber],
    ['Date of birth', dob ? `${dob.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} (age ${ageOn(dob)})` : null],
    ['Gender', profile?.gender ? title(profile.gender) : null],
    ['Location', m.location],
    ['Address', profile?.address],
    ['Member category', profile?.memberCategory ? title(profile.memberCategory) : null],
    ['Next of kin', [profile?.nextOfKinName, profile?.nextOfKinPhone, profile?.nextOfKinRelationship].filter(Boolean).join(' · ') || null],
    ['Profession', profile?.profession],
    ['Skills', profile?.skills],
    ['Achievements', profile?.achievements],
    ['Mentorship area', profile?.mentorshipArea],
    ['Interests', profile?.interests],
    ['Education', profile?.educationLevel ? title(profile.educationLevel) : null],
    ['Family branch', profile?.familyBranch],
    ['Standing', m.standing === 'PAID_UP' ? 'Paid-up' : 'Lapsed'],
    ['Contribution rights', m.contributionExempt ? 'Follows your standing' : 'Pays their own dues'],
    ['Joined', (m.approvedAt ?? m.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })],
    ['Emergency contact', [profile?.emergencyContactName, profile?.emergencyContactPhone].filter(Boolean).join(' · ') || null],
  ]
  return rows.map(([label, value]) => [label, value || 'Not provided'])
}

export default async function MyFamilyPage({ adminWorkspace = false }: { adminWorkspace?: boolean }) {
  const actor = await requireActiveRole([
    'MEMBER',
    'ADMIN',
    'EXECUTIVE',
    'TREASURER',
    'SECRETARY',
    'ORGANIZER',
  ])
  const me = await prisma.user.findUnique({
    where: { id: actor.id },
    include: {
      memberProfile: true,
      principal: { select: { id: true, fullName: true } },
      attachedMembers: {
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          familyRelationship: true,
          familyRegistrationState: true,
          phone: true,
          location: true,
          membershipNumber: true,
          standing: true,
          contributionExempt: true,
          approvedAt: true,
          createdAt: true,
          memberProfile: {
            select: {
              dateOfBirth: true,
              gender: true,
              profession: true,
              educationLevel: true,
              familyBranch: true,
              emergencyContactName: true,
              emergencyContactPhone: true,
              address: true,
              nextOfKinName: true,
              nextOfKinPhone: true,
              nextOfKinRelationship: true,
              skills: true,
              achievements: true,
              mentorshipArea: true,
              interests: true,
              memberCategory: true,
            },
          },
          isPrincipal: true,
        },
      },
      familyInvitesSent: {
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!me) {
    return (
      <DashboardShell role="MEMBER" title="My Family" nav={navForRole('MEMBER')}>
        <p className="p-6 text-sm">Profile not found.</p>
      </DashboardShell>
    )
  }

  const branchRootId = me.isPrincipal ? me.id : me.principalMemberId
  // A dev server can briefly retain the previous generated Prisma client during hot reload.
  // Keep the family page usable until the server has reloaded the newly generated delegate.
  const transitionDelegate = prisma.familyAccountTransition
  const transitionHistory = branchRootId && transitionDelegate
    ? await transitionDelegate.findMany({
        where: { member: { OR: [{ id: branchRootId }, { principalMemberId: branchRootId }] } },
        orderBy: { occurredAt: 'desc' }, take: 30,
        select: { id: true, type: true, reason: true, fromState: true, toState: true, occurredAt: true, member: { select: { fullName: true } } },
      }).catch(() => [])
    : []
  const showAdminNavigation = adminWorkspace && (actor.isSuperAdmin || actor.role === 'ADMIN')
  const workspaceRole = showAdminNavigation ? 'ADMIN' : 'MEMBER'
  const branchMembers = me.isPrincipal
    ? [
        ...me.attachedMembers.map((m) => ({
          id: m.id,
          fullName: m.fullName,
          email: m.email,
          relationship: m.familyRelationship
            ? RELATIONSHIP_LABEL[m.familyRelationship] || m.familyRelationship
            : null,
          status: m.status,
          registrationState: m.familyRegistrationState,
          phone: m.phone,
          location: m.location,
          isPrincipal: false,
          // The Principal sees every detail of the members attached to them.
          details: fullDetails(m),
        })),
      ]
    : branchRootId
      ? await (async () => {
          const siblings = await prisma.user.findMany({
            where: {
              OR: [{ id: branchRootId }, { principalMemberId: branchRootId }],
            },
            orderBy: { fullName: 'asc' },
            select: {
              id: true,
              fullName: true,
              email: true,
              status: true,
              isPrincipal: true,
              familyRelationship: true,
              familyRegistrationState: true,
              phone: true,
              location: true,
            },
          })
          return siblings.filter((m) => m.id !== me.id).map((m) => ({
            id: m.id,
            fullName: m.fullName,
            email: m.isPrincipal ? '' : m.email,
            relationship: m.isPrincipal
              ? 'Principal'
              : m.familyRelationship
                ? RELATIONSHIP_LABEL[m.familyRelationship] || m.familyRelationship
                : null,
            status: m.isPrincipal ? '' : m.status,
            registrationState: m.isPrincipal ? '' : m.familyRegistrationState,
            phone: m.phone,
            location: m.location,
            isPrincipal: m.isPrincipal,
            isYou: m.id === me.id,
            ...(m.id === me.id ? { details: fullDetails(me) } : {}),
          }))
        })()
      : []

  return (
    <DashboardShell
      role={workspaceRole}
      title="My Family"
      nav={navForRole(workspaceRole)}
      hideRelatedLinks
      pageAction={showAdminNavigation ? (
        <a href="/admin/family" className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          All Principals and branches
        </a>
      ) : undefined}
    >
      <FamilyBranchClient
        isPrincipal={me.isPrincipal}
        canManage={false}
        principalName={me.isPrincipal ? me.fullName : me.principal?.fullName || null}
        relationshipLabel={
          me.familyRelationship
            ? RELATIONSHIP_LABEL[me.familyRelationship] || me.familyRelationship
            : null
        }
        members={branchMembers}
        pendingInvites={me.familyInvitesSent.map((i) => ({
          id: i.id,
          email: i.email,
          expiresAt: i.expiresAt.toISOString(),
          acceptedAt: i.acceptedAt?.toISOString() || null,
        }))}
        transitionHistory={transitionHistory.map((item) => ({ ...item, memberName: item.member.fullName, member: undefined, occurredAt: item.occurredAt.toISOString() }))}
      />
      {me.isPrincipal && (
        <div className="mt-4 space-y-4 px-4 md:px-0">
          <BranchPaymentsPanel />
        </div>
      )}
    </DashboardShell>
  )
}
