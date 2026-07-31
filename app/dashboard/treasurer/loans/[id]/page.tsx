import Link from 'next/link'
import { notFound } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { requireActiveRole } from '@/lib/auth/session'
import { TREASURER_NAV, LOANS_NAV_ITEMS, withOptionalNav } from '@/lib/dashboard/nav'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/feature-flags'
import { loanOutstandingKes, moneyNumber } from '@/lib/loans'
import { prisma } from '@/lib/prisma'
import {
  recordLoanDisbursement,
  recordLoanRepayment,
  treasurerReviewLoan,
} from '@/app/actions/loans'

export default async function TreasurerLoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!(await isFeatureEnabled(FEATURE_FLAGS.loansEnabled))) notFound()
  await requireActiveRole(['TREASURER', 'ADMIN'])
  const { id } = await params
  const loan = await prisma.loanApplication.findUnique({
    where: { id },
    include: {
      applicant: {
        include: {
          memberProfile: true,
          contributions: { orderBy: { paidAt: 'desc' }, take: 20 },
          welfareRequests: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      },
      guarantors: { include: { user: { select: { fullName: true, email: true } } } },
      reviewedBy: { select: { fullName: true } },
      decidedBy: { select: { fullName: true } },
      ledgerLinks: {
        include: { transaction: { select: { id: true, amount: true, status: true, occurredAt: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!loan) notFound()

  const [accounts, contributionSum, outstanding] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { active: true, code: { in: ['CASH', 'BANK', 'MPESA', 'GENERAL_FUND'] } },
      orderBy: { name: 'asc' },
    }),
    prisma.contribution.aggregate({
      where: {
        userId: loan.applicantId,
        status: { in: ['CONFIRMED', 'RECONCILED'] },
      },
      _sum: { amount: true },
    }),
    loanOutstandingKes(loan.id),
  ])

  const nav = withOptionalNav(TREASURER_NAV, LOANS_NAV_ITEMS.treasurer, '/dashboard/treasurer/welfare')
  const profile = loan.applicant.memberProfile

  return (
    <DashboardShell role="TREASURER" title="Loan review" nav={nav}>
      <div className="space-y-6 p-4 md:p-6">
        <Link href="/dashboard/treasurer/loans" className="text-sm text-primary underline">
          Back to loans
        </Link>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <section className="rounded-2xl border bg-surface p-5">
              <h1 className="font-h3 text-xl text-primary">
                {loan.applicant.fullName} · KES {moneyNumber(loan.amountKes).toLocaleString()}
              </h1>
              <p className="text-sm">{loan.status}</p>
              <p className="mt-2 whitespace-pre-line text-sm">{loan.purpose}</p>
              {loan.installmentNotes && (
                <p className="mt-2 text-xs text-on-surface-variant">Installments: {loan.installmentNotes}</p>
              )}
              <ul className="mt-3 space-y-1 text-sm">
                {loan.guarantors.map((g) => (
                  <li key={g.id}>
                    {g.user.fullName} — {g.status}
                  </li>
                ))}
              </ul>
            </section>

            {['SUBMITTED', 'UNDER_REVIEW'].includes(loan.status) && (
              <section className="rounded-2xl border bg-surface p-5">
                <h2 className="font-h3 text-lg text-primary">Treasurer note</h2>
                <form action={treasurerReviewLoan} className="mt-3 space-y-2">
                  <input type="hidden" name="loanId" value={loan.id} />
                  <textarea
                    name="treasurerNote"
                    required
                    defaultValue={loan.treasurerNote || ''}
                    className="w-full rounded-lg border px-3 py-2"
                    rows={4}
                    placeholder="Review notes for Admin"
                  />
                  <label className="block text-sm">
                    <input type="checkbox" name="markUnderReview" defaultChecked /> Mark under review
                  </label>
                  <button className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Save review</button>
                </form>
              </section>
            )}

            {loan.status === 'APPROVED' && (
              <section className="rounded-2xl border bg-surface p-5">
                <h2 className="font-h3 text-lg text-primary">Record disbursement</h2>
                <form action={recordLoanDisbursement} className="mt-3 grid gap-2 md:grid-cols-2">
                  <input type="hidden" name="loanId" value={loan.id} />
                  <input
                    name="amount"
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    defaultValue={moneyNumber(loan.amountKes)}
                    className="rounded-lg border px-3 py-2"
                  />
                  <select name="sourceAccountId" required className="rounded-lg border px-3 py-2">
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <input
                    name="occurredAt"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="rounded-lg border px-3 py-2"
                  />
                  <input name="evidence" type="file" accept=".pdf,image/*" className="rounded-lg border px-3 py-2" />
                  <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Disburse</button>
                </form>
              </section>
            )}

            {loan.status === 'DISBURSED' && (
              <section className="rounded-2xl border bg-surface p-5">
                <h2 className="font-h3 text-lg text-primary">
                  Record repayment · outstanding KES {outstanding.toLocaleString()}
                </h2>
                <form action={recordLoanRepayment} className="mt-3 grid gap-2 md:grid-cols-2">
                  <input type="hidden" name="loanId" value={loan.id} />
                  <input name="amount" type="number" min={1} step="0.01" required className="rounded-lg border px-3 py-2" />
                  <select name="destinationAccountId" required className="rounded-lg border px-3 py-2">
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <select name="paymentMethod" className="rounded-lg border px-3 py-2">
                    <option value="CASH">CASH</option>
                    <option value="MPESA">MPESA</option>
                    <option value="BANK">BANK</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                  <input
                    name="occurredAt"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="rounded-lg border px-3 py-2"
                  />
                  <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Record repayment</button>
                </form>
              </section>
            )}

            <section className="rounded-2xl border bg-surface p-5">
              <h2 className="font-h3 text-lg text-primary">Ledger links</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {loan.ledgerLinks.map((l) => (
                  <li key={l.id}>
                    {l.kind} · KES {moneyNumber(l.transaction.amount).toLocaleString()} · {l.transaction.status} ·{' '}
                    {l.transaction.occurredAt.toLocaleDateString()}
                  </li>
                ))}
                {!loan.ledgerLinks.length && <li>None yet.</li>}
              </ul>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border bg-surface p-5 text-sm">
              <h2 className="font-h3 text-lg text-primary">Applicant</h2>
              <p>{loan.applicant.fullName}</p>
              <p>{loan.applicant.email}</p>
              <p>{loan.applicant.phone || 'No phone'}</p>
              <p className="mt-2 text-xs text-on-surface-variant">
                Branch: {profile?.familyBranch || '—'}
                <br />
                Category: {profile?.memberCategory || '—'}
                <br />
                Profession: {profile?.profession || '—'}
              </p>
              <p className="mt-3 font-semibold">
                Confirmed contributions: KES {Number(contributionSum._sum.amount || 0).toLocaleString()}
              </p>
            </section>
            <section className="rounded-2xl border bg-surface p-5 text-sm">
              <h2 className="font-h3 text-base text-primary">Recent contributions</h2>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {loan.applicant.contributions.map((c) => (
                  <li key={c.id}>
                    {c.paidAt.toLocaleDateString()} · {Number(c.amount).toLocaleString()} · {c.status}
                  </li>
                ))}
                {!loan.applicant.contributions.length && <li>None</li>}
              </ul>
            </section>
            <section className="rounded-2xl border bg-surface p-5 text-sm">
              <h2 className="font-h3 text-base text-primary">Welfare history</h2>
              <ul className="mt-2 space-y-1">
                {loan.applicant.welfareRequests.map((w) => (
                  <li key={w.id}>
                    {w.status} · {w.amount?.toLocaleString() ?? '—'} · {w.description.slice(0, 40)}
                  </li>
                ))}
                {!loan.applicant.welfareRequests.length && <li>None</li>}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </DashboardShell>
  )
}
