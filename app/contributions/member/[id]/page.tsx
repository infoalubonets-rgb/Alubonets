import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import ContributionsClient from '@/components/dashboard/ContributionsClient'
import { navForRole } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { canViewAllFinances } from '@/lib/finance-access'
import { prisma } from '@/lib/prisma'
import type { Role } from '@/lib/auth/types'
import type { TransactionStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Member contributions' }

const toView = (c: { id: string; amount: number; paidAt: Date; category: string | null; status: string; transactionCategory: { name: string } | null }) => ({
  id: c.id,
  amount: c.amount,
  paidAt: c.paidAt.toISOString(),
  category: c.transactionCategory?.name || c.category,
  status: c.status,
})

const contributionSelect = {
  id: true,
  amount: true,
  paidAt: true,
  category: true,
  status: true,
  transactionCategory: { select: { name: true } },
} as const

/** One member's contributions, for Admin, Super Admin, Treasurer and Auditor. */
export default async function MemberContributionsPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login?next=/contributions')
  if (!canViewAllFinances(profile)) redirect('/contributions')

  const { id } = await params
  const member = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      membershipNumber: true,
      standing: true,
      isPrincipal: true,
      attachedMembers: { select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } },
    },
  })
  if (!member) notFound()

  const statuses: { in: TransactionStatus[] } = { in: ['CONFIRMED', 'RECONCILED', 'PENDING', 'REJECTED'] }
  const [own, attached] = await Promise.all([
    prisma.contribution.findMany({ where: { userId: member.id, status: statuses }, select: contributionSelect, orderBy: { paidAt: 'desc' } }),
    Promise.all(
      member.attachedMembers.map((attachedMember) =>
        prisma.contribution.findMany({ where: { userId: attachedMember.id, status: statuses }, select: contributionSelect, orderBy: { paidAt: 'desc' } }),
      ),
    ),
  ])

  const role = profile.role as Role
  return (
    <DashboardShell role={role} title={member.fullName} nav={navForRole(role)}>
      <div className="mx-auto max-w-3xl space-y-4 px-4 pb-4 pt-4 md:px-0">
        <Link href="/contributions?tab=members" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Members’ contributions
        </Link>
        <p className="text-sm text-on-surface-variant">
          {member.membershipNumber ? `${member.membershipNumber} · ` : ''}
          {member.standing === 'PAID_UP' ? 'Paid-up' : 'Lapsed'}
          {member.isPrincipal && member.attachedMembers.length > 0 ? ` · Principal of ${member.attachedMembers.length}` : ''}
        </p>
      </div>
      <ContributionsClient
        contributions={own.map(toView)}
        userId={member.id}
        ownerLabel={member.fullName}
        familyMembers={member.attachedMembers.map((attachedMember, index) => ({
          id: attachedMember.id,
          fullName: attachedMember.fullName,
          contributions: attached[index].map(toView),
        }))}
        canSubmitPayment={false}
      />
    </DashboardShell>
  )
}
