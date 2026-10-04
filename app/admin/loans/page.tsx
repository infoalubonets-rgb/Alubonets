import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import ModuleDisabled from '@/components/dashboard/ModuleDisabled'
import { requireAdmin } from '@/lib/auth/session'
import { ADMIN_NAV, LOANS_NAV_ITEMS, withOptionalNav } from '@/lib/dashboard/nav'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/feature-flags'
import { loanBalancesForIds, moneyNumber } from '@/lib/loans'
import { getLoanPolicy } from '@/lib/settings'
import { prisma } from '@/lib/prisma'
import { decideLoanApplication } from '@/app/actions/loans'

export default async function AdminLoansPage() {
  if (!(await isFeatureEnabled(FEATURE_FLAGS.loansEnabled))) return <ModuleDisabled module="Loans" />
  await requireAdmin()
  const policy = await getLoanPolicy()
  const loans = await prisma.loanApplication.findMany({
    where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DISBURSED', 'REJECTED', 'CLOSED'] } },
    include: {
      applicant: { select: { fullName: true, email: true } },
      guarantors: true,
      reviewedBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 80,
  })
  const balances = await loanBalancesForIds(loans.map((l) => l.id))
  const nav = withOptionalNav(ADMIN_NAV, LOANS_NAV_ITEMS.admin, '/admin/finance')

  return (
    <DashboardShell role="ADMIN" title="Loan approvals" nav={nav}>
      <div className="space-y-4 p-4 md:p-6">
        <p className="text-sm text-on-surface-variant">
          Policy: KES {policy.minAmountKes.toLocaleString()}–{policy.maxAmountKes.toLocaleString()} · min guarantors {policy.minGuarantors}
          {policy.requireGuarantorAccept ? ' · guarantor accept required' : ''}.{' '}
          <Link href="/admin/settings" className="text-primary underline">
            Settings
          </Link>
          {' · '}
          <a href="/api/pdf/loan-policy?download=1" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            Download loan policy PDF
          </a>
        </p>
        {loans.map((loan) => {
          const accepted = loan.guarantors.filter((g) => g.status === 'ACCEPTED' || !g.userId).length
          const canApprove =
            ['SUBMITTED', 'UNDER_REVIEW'].includes(loan.status) &&
            (!policy.requireGuarantorAccept || accepted >= policy.minGuarantors)
          return (
            <article key={loan.id} className="rounded-xl border bg-surface p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <b>{loan.applicant.fullName}</b> · KES {moneyNumber(loan.amountKes).toLocaleString()} ·{' '}
                  {loan.status}
                  <p>{loan.purpose}</p>
                  <p className="text-xs text-on-surface-variant">
                    Eligible guarantors {accepted}/{loan.guarantors.length}
                    {loan.reviewedBy ? ` · reviewed by ${loan.reviewedBy.fullName}` : ' · not yet treasurer-reviewed'}
                    {loan.treasurerNote ? ` · note: ${loan.treasurerNote}` : ''}
                    {['DISBURSED', 'CLOSED'].includes(loan.status)
                      ? ` · outstanding ${(balances.get(loan.id) || 0).toLocaleString()}`
                      : ''}
                  </p>
                </div>
                <Link href={`/dashboard/treasurer/loans/${loan.id}`} className="text-primary underline">
                  Full context
                </Link>
              </div>
              {['SUBMITTED', 'UNDER_REVIEW'].includes(loan.status) && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <form action={decideLoanApplication} className="flex flex-wrap gap-2">
                    <input type="hidden" name="loanId" value={loan.id} />
                    <input type="hidden" name="decision" value="APPROVED" />
                    <input name="decisionNote" placeholder="Approval note" className="rounded-lg border px-2 py-1" />
                    <button disabled={!canApprove} className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40">
                      Approve
                    </button>
                  </form>
                  <form action={decideLoanApplication} className="flex flex-wrap gap-2">
                    <input type="hidden" name="loanId" value={loan.id} />
                    <input type="hidden" name="decision" value="REJECTED" />
                    <input name="decisionNote" placeholder="Rejection reason" className="rounded-lg border px-2 py-1" />
                    <button className="rounded-lg border px-3 py-1.5 text-xs">Reject</button>
                  </form>
                </div>
              )}
            </article>
          )
        })}
        {!loans.length && <p className="text-sm">No loans yet.</p>}
      </div>
    </DashboardShell>
  )
}
