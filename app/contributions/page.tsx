import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { navForRole } from '@/lib/dashboard/nav'
import { getSessionProfile, getAccountProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { rangeFilter, resolveTimeRange, type ResolvedTimeRange } from '@/lib/time-range'
import { TAGS } from '@/lib/data/queries'
import type { Role } from '@/lib/auth/types'
import ContributionsClient from '@/components/dashboard/ContributionsClient'
import { canRecordContributions, canRecordPayments, canViewAllFinances } from '@/lib/finance-access'
import AddContributionButton from '@/components/finance/AddContributionButton'
import ImportContributionsButton from '@/components/finance/ImportContributionsButton'
import ContributionTabs from '@/components/dashboard/ContributionTabs'
import MemberContributionsTable, { type MemberContributionRow } from '@/components/dashboard/MemberContributionsTable'

export const dynamic = 'force-dynamic'
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  return { title: tab === 'members' ? 'Member contributions' : 'My contributions' }
}

function getUserContributions(userId: string) {
  return unstable_cache(
    async () =>
      prisma.contribution.findMany({
        where: { userId, status: { in: ['CONFIRMED', 'RECONCILED', 'PENDING', 'REJECTED'] } },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          category: true,
          status: true,
          transactionCategory: { select: { name: true } },
        },
        orderBy: { paidAt: 'desc' },
      }),
    [`contributions-${userId}`],
    { tags: [TAGS.contributions] },
  )()
}

/** A Principal Member can review contributions for the members attached to their branch. */
function getAttachedMembers(principalId: string) {
  return unstable_cache(
    async () =>
      prisma.user.findMany({
        where: { principalMemberId: principalId, status: 'ACTIVE' },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      }),
    [`attached-members-${principalId}`],
    { tags: [TAGS.members] },
  )()
}

/** One row per member: confirmed totals, pending checks and last payment — all time or a period. */
async function getMemberContributionRows(range: ResolvedTimeRange): Promise<MemberContributionRow[]> {
  const paidAt = rangeFilter(range)
  const [members, paid, pending] = await Promise.all([
    prisma.user.findMany({
      where: { status: { not: 'PENDING' } },
      select: { id: true, fullName: true, membershipNumber: true, status: true, standing: true, contributionPlan: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.contribution.groupBy({
      by: ['userId'],
      where: { status: { in: ['CONFIRMED', 'RECONCILED'] }, ...(paidAt ? { paidAt } : {}) },
      _sum: { amount: true },
      _count: true,
      _max: { paidAt: true },
    }),
    prisma.contribution.groupBy({ by: ['userId'], where: { status: 'PENDING', ...(paidAt ? { paidAt } : {}) }, _count: true }),
  ])
  const paidBy = new Map(paid.map((row) => [row.userId, row]))
  const pendingBy = new Map(pending.map((row) => [row.userId, row._count]))
  return members.map((member) => {
    const totals = paidBy.get(member.id)
    return {
      id: member.id,
      fullName: member.fullName,
      membershipNumber: member.membershipNumber,
      status: member.status,
      standing: member.standing,
      plan: member.contributionPlan,
      payments: totals?._count ?? 0,
      totalPaid: Number(totals?._sum.amount ?? 0),
      pending: pendingBy.get(member.id) ?? 0,
      lastPaidAt: totals?._max.paidAt?.toISOString() ?? null,
    }
  })
}

export default async function ContributionsPage({ searchParams }: { searchParams: Promise<{ tab?: string; month?: string; range?: string; from?: string; to?: string }> }) {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login?next=/contributions')
  if (profile.status === 'SUSPENDED') redirect('/login?error=suspended')

  const role = profile.role as Role
  const seesAll = canViewAllFinances(profile)
  const title = seesAll ? 'Contributions' : 'My contributions'

  const sp = await searchParams
  if (seesAll && sp.tab === 'members') {
    // Old ?month=YYYY-MM links become a custom range for that month.
    const monthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(sp.month ?? '')
    const period = resolveTimeRange(monthMatch
      ? { range: 'custom', from: `${sp.month}-01`, to: new Date(Date.UTC(Number(monthMatch[1]), Number(monthMatch[2]), 0)).toISOString().slice(0, 10) }
      : sp)
    const account = await getAccountProfile()
    const rows = await getMemberContributionRows(period)
    return (
      <DashboardShell
        role={role}
        title={title}
        nav={navForRole(role)}
        pageAction={
          <div className="flex flex-wrap items-center gap-2">
            <AddContributionButton />
            {account && canRecordContributions(account) && <ImportContributionsButton />}
            <ContributionTabs active="members" />
          </div>
        }
      >
        <div className="space-y-4 pt-4">
          {/* Only the Treasurer can correct a payment amount (audited). */}
          <MemberContributionsTable
            rows={rows}
            period={{ key: period.key, from: period.from, to: period.to, label: period.label }}
            canEditAmounts={canRecordPayments(profile)}
            canSetPlan={canRecordPayments(profile) || profile.role === 'ADMIN' || Boolean(profile.isSuperAdmin)}
            canDelete={Boolean(account && canRecordContributions(account))}
          />
        </div>
      </DashboardShell>
    )
  }
  let contributions
  let familyMembers: {
    id: string
    fullName: string
    contributions: {
      id: string
      amount: number
      paidAt: string
      category: string | null
      status: string
    }[]
  }[] = []
  try {
    const attached = await getAttachedMembers(profile.id)
    const [ownContributions, attachedContributions] = await Promise.all([
      getUserContributions(profile.id),
      Promise.all(attached.map((member) => getUserContributions(member.id))),
    ])
    contributions = ownContributions
    familyMembers = attached.map((member, index) => ({
      id: member.id,
      fullName: member.fullName,
      contributions: attachedContributions[index].map((c) => ({
        id: c.id,
        amount: c.amount,
        paidAt: new Date(c.paidAt).toISOString(),
        category: c.transactionCategory?.name || c.category,
        status: c.status,
      })),
    }))
  } catch (error) {
    console.error('Could not load member contributions', error)
    return (
      <DashboardShell
        role={role}
        title={title}
        nav={navForRole(role)}
        pageAction={seesAll ? <ContributionTabs active="mine" /> : undefined}
      >
        <section className="mx-auto mt-8 max-w-xl rounded-2xl border border-error/30 bg-surface p-6 text-center">
          <span className="material-symbols-outlined text-4xl text-error">cloud_off</span>
          <h2 className="mt-2 font-h3 text-xl text-primary">Contributions are temporarily unavailable</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            The database could not be reached. Your records are safe; please try loading this page again.
          </p>
          <a href="/contributions" className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-sm text-on-primary">
            Try again
          </a>
        </section>
      </DashboardShell>
    )
  }
  return (
    <DashboardShell
      role={role}
      title={title}
      nav={navForRole(role)}
      pageAction={seesAll ? <ContributionTabs active="mine" /> : undefined}
    >
      <ContributionsClient
        contributions={contributions.map((c) => ({
          id: c.id,
          amount: c.amount,
          paidAt: new Date(c.paidAt).toISOString(),
          category: c.transactionCategory?.name || c.category,
          status: c.status,
        }))}
        userId={profile.id}
        familyMembers={familyMembers}
        canSubmitPayment={false}
      />
    </DashboardShell>
  )
}
