import DashboardShell from '@/components/dashboard/DashboardShell'
import FamilyBranchClient from '@/components/dashboard/FamilyBranchClient'
import FamilyAdministrationClient from '@/components/admin/FamilyAdministrationClient'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { getSetting, SETTING_KEYS } from '@/lib/settings'
import { ageOn } from '@/lib/family-transition'

const RELATIONSHIP_LABEL: Record<string, string> = {
  SPOUSE: 'Spouse',
  SON: 'Son',
  DAUGHTER: 'Daughter',
  CHILD: 'Child',
  DEPENDENT: 'Dependent',
  OTHER: 'Other',
}

export default async function MemberFamilyPage() {
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
      memberProfile: { select: { familyBranch: true } },
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
          memberProfile: { select: { dateOfBirth: true, familyBranch: true } },
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
      <DashboardShell role={actor.role} title="My Family / Branch" nav={navForRole(actor.role)}>
        <p className="p-6 text-sm">Profile not found.</p>
      </DashboardShell>
    )
  }

  const branchRootId = me.isPrincipal ? me.id : me.principalMemberId
  const adulthoodAge = Number(await getSetting(SETTING_KEYS.familyAdulthoodAge))
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
  const canAdministerFamilies = actor.isSuperAdmin || actor.role === 'ADMIN'
  const administrationMembers = canAdministerFamilies
    ? await prisma.user.findMany({
        where: { status: { in: ['ACTIVE', 'PENDING', 'INACTIVE'] } },
        orderBy: { fullName: 'asc' }, take: 500,
        select: { id: true, fullName: true, email: true, phone: true, status: true, isPrincipal: true, principalMemberId: true, familyRelationship: true, principal: { select: { fullName: true } }, memberProfile: { select: { familyBranch: true } } },
      })
    : []
  const administrationPrincipals = administrationMembers
    .filter((member) => member.isPrincipal && member.status === 'ACTIVE')
    .map((member) => ({ id: member.id, fullName: member.fullName }))
  const branchMembers = me.isPrincipal
    ? [
        {
          id: me.id,
          fullName: me.fullName,
          email: me.email,
          relationship: null as string | null,
          status: me.status,
          registrationState: me.familyRegistrationState,
          isYou: true,
        },
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
          lineage: m.memberProfile?.familyBranch || null,
          adultInviteEligible: m.familyRegistrationState === 'RECORD_ONLY' && Boolean(m.memberProfile?.dateOfBirth) && ageOn(m.memberProfile!.dateOfBirth!) >= adulthoodAge,
        })),
      ]
    : branchRootId
      ? await (async () => {
          const principal = me.principal
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
              memberProfile: { select: { familyBranch: true } },
            },
          })
          return siblings.map((m) => ({
            id: m.id,
            fullName: m.fullName,
            email: m.email,
            relationship: m.isPrincipal
              ? 'Principal'
              : m.familyRelationship
                ? RELATIONSHIP_LABEL[m.familyRelationship] || m.familyRelationship
                : null,
            status: m.status,
            registrationState: m.familyRegistrationState,
            phone: m.phone,
            lineage: m.memberProfile?.familyBranch || null,
            isYou: m.id === me.id,
          }))
        })()
      : [
          {
            id: me.id,
            fullName: me.fullName,
            email: me.email,
            relationship: null,
            status: me.status,
            registrationState: me.familyRegistrationState,
            phone: me.phone,
            lineage: null,
            isYou: true,
          },
        ]

  return (
    <DashboardShell role={actor.role} title={canAdministerFamilies ? 'Family Directory' : 'My Family / Branch'} nav={navForRole(actor.role)} hidePageHeading>
      {canAdministerFamilies && <FamilyAdministrationClient
        members={administrationMembers.map((member) => ({ ...member, relationship: member.familyRelationship ? RELATIONSHIP_LABEL[member.familyRelationship] || member.familyRelationship : null, lineage: member.memberProfile?.familyBranch || null, principalName: member.principal?.fullName || null, principal: undefined, memberProfile: undefined, familyRelationship: undefined }))}
        principals={administrationPrincipals}
      />}
      {!canAdministerFamilies && <FamilyBranchClient
        isPrincipal={me.isPrincipal}
        defaultLineage={me.memberProfile?.familyBranch || ''}
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
        adulthoodAge={adulthoodAge}
        transitionHistory={transitionHistory.map((item) => ({ ...item, memberName: item.member.fullName, member: undefined, occurredAt: item.occurredAt.toISOString() }))}
      />}
    </DashboardShell>
  )
}
