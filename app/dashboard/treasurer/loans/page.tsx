import Link from 'next/link'
import { notFound } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { requireActiveRole } from '@/lib/auth/session'
import { TREASURER_NAV, LOANS_NAV_ITEMS, withOptionalNav } from '@/lib/dashboard/nav'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/feature-flags'
import { loanBalancesForIds, moneyNumber } from '@/lib/loans'
import { prisma } from '@/lib/prisma'

export default async function TreasurerLoansPage() {
  if (!(await isFeatureEnabled(FEATURE_FLAGS.loansEnabled))) notFound()
  await requireActiveRole(['TREASURER', 'ADMIN'])
  const loans = await prisma.loanApplication.findMany({
    include: {
      applicant: { select: { id: true, fullName: true, email: true } },
      guarantors: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const balances = await loanBalancesForIds(loans.map((l) => l.id))
  const nav = withOptionalNav(TREASURER_NAV, LOANS_NAV_ITEMS.treasurer, '/dashboard/treasurer/welfare')

  return (
    <DashboardShell role="TREASURER" title="Loans" nav={nav}>
      <div className="space-y-4 p-4 md:p-6">
        {loans.map((loan) => (
          <article key={loan.id} className="rounded-xl border bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <b>{loan.applicant.fullName}</b> · KES {moneyNumber(loan.amountKes).toLocaleString()} · {loan.status}
                <p className="text-on-surface-variant">{loan.purpose}</p>
                <p className="text-xs">
                  Guarantors accepted: {loan.guarantors.filter((g) => g.status === 'ACCEPTED').length}/
                  {loan.guarantors.length}
                  {['DISBURSED', 'CLOSED'].includes(loan.status)
                    ? ` · outstanding ${(balances.get(loan.id) || 0).toLocaleString()}`
                    : ''}
                </p>
              </div>
              <Link href={`/dashboard/treasurer/loans/${loan.id}`} className="text-primary underline">
                Review
              </Link>
            </div>
          </article>
        ))}
        {!loans.length && <p className="text-sm">No loan applications.</p>}
      </div>
    </DashboardShell>
  )
}
