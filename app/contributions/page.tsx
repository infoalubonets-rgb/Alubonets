import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { navForRole } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { TAGS } from '@/lib/data/queries'
import type { Role } from '@/lib/auth/types'
import ContributionsClient from '@/components/dashboard/ContributionsClient'
import OfficialPaymentDestination from '@/components/dashboard/OfficialPaymentDestination'
import { getActiveFinanceDestination } from '@/app/actions/finance'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My contributions' }

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

export default async function ContributionsPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login?next=/contributions')
  if (profile.status === 'SUSPENDED') redirect('/login?error=suspended')

  const role = profile.role as Role
  let contributions
  let destination = null as Awaited<ReturnType<typeof getActiveFinanceDestination>>
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
    const [ownContributions, attachedContributions, financeDestination] = await Promise.all([
      getUserContributions(profile.id),
      Promise.all(attached.map((member) => getUserContributions(member.id))),
      getActiveFinanceDestination(),
    ])
    contributions = ownContributions
    destination = financeDestination
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
      <DashboardShell role={role} title="My contributions" nav={navForRole(role)}>
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
    <DashboardShell role={role} title="My contributions" nav={navForRole(role)}>
      <div className="mx-auto max-w-3xl space-y-4 pb-4 pt-4 px-4 md:px-0">
        <OfficialPaymentDestination destination={destination} />
      </div>
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
