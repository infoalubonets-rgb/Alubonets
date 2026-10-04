import DashboardShell from '@/components/dashboard/DashboardShell'
import ModuleDisabled from '@/components/dashboard/ModuleDisabled'
import { requireActiveRole } from '@/lib/auth/session'
import { EXECUTIVE_NAV, LOANS_NAV_ITEMS, withOptionalNav } from '@/lib/dashboard/nav'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/feature-flags'
import { loanBalancesForIds, moneyNumber } from '@/lib/loans'
import { prisma } from '@/lib/prisma'

export default async function ExecutiveLoansPage() {
  if (!(await isFeatureEnabled(FEATURE_FLAGS.loansEnabled))) return <ModuleDisabled module="Loans" />
  await requireActiveRole(['EXECUTIVE', 'ADMIN'])
  const loans = await prisma.loanApplication.findMany({
    where: { status: { in: ['APPROVED', 'DISBURSED', 'CLOSED'] } },
    include: { applicant: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const balances = await loanBalancesForIds(loans.map((l) => l.id))
  const outstandingTotal = [...balances.values()].reduce((a, b) => a + b, 0)
  const nav = withOptionalNav(EXECUTIVE_NAV, LOANS_NAV_ITEMS.executive, '/financial-reports')

  return (
    <DashboardShell role="EXECUTIVE" title="Loan report" nav={nav}>
      <div className="space-y-4 p-4 md:p-6">
        <p className="rounded-xl border bg-surface p-4 text-sm">
          Total outstanding (disbursed − repayments): <b>KES {outstandingTotal.toLocaleString()}</b>
        </p>
        <div className="overflow-x-auto rounded-xl border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-on-surface-variant">
                <th className="p-3">Member</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.id} className="border-b">
                  <td className="p-3">{loan.applicant.fullName}</td>
                  <td className="p-3">{moneyNumber(loan.amountKes).toLocaleString()}</td>
                  <td className="p-3">{loan.status}</td>
                  <td className="p-3">{(balances.get(loan.id) || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loans.length && <p className="p-4 text-sm">No approved/disbursed loans.</p>}
        </div>
      </div>
    </DashboardShell>
  )
}
