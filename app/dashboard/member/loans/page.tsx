import { notFound } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { requireActiveRole } from '@/lib/auth/session'
import { MEMBER_NAV, LOANS_NAV_ITEMS, withOptionalNav, navForRole } from '@/lib/dashboard/nav'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/feature-flags'
import { getLoanPolicy } from '@/lib/settings'
import { loanBalancesForIds, moneyNumber } from '@/lib/loans'
import { prisma } from '@/lib/prisma'
import { respondLoanGuarantor, submitLoanApplication } from '@/app/actions/loans'

export default async function MemberLoansPage() {
  const loansOn = await isFeatureEnabled(FEATURE_FLAGS.loansEnabled)
  if (!loansOn) notFound()
  const actor = await requireActiveRole([
    'ADMIN',
    'EXECUTIVE',
    'TREASURER',
    'SECRETARY',
    'ORGANIZER',
    'MEMBER',
  ])
  const policy = await getLoanPolicy()
  const [mine, guarantorInvites, members] = await Promise.all([
    prisma.loanApplication.findMany({
      where: { applicantId: actor.id },
      include: { guarantors: { include: { user: { select: { fullName: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.loanGuarantor.findMany({
      where: { userId: actor.id },
      include: {
        loan: {
          include: { applicant: { select: { fullName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE', id: { not: actor.id } },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
  ])
  const balances = await loanBalancesForIds(mine.map((l) => l.id))
  const nav = withOptionalNav(navForRole(actor.role), LOANS_NAV_ITEMS.member, '/contributions')

  return (
    <DashboardShell role={actor.role} title="Loans" nav={nav.length ? nav : withOptionalNav(MEMBER_NAV, LOANS_NAV_ITEMS.member)}>
      <div className="space-y-6 p-4 md:p-6">
        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">Apply for a loan</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Max KES {policy.maxAmountKes.toLocaleString()} · at least {policy.minGuarantors} guarantor(s)
          </p>
          <form action={submitLoanApplication} className="mt-3 grid gap-2 md:grid-cols-2">
            <input name="amountKes" type="number" min={1} step="0.01" required placeholder="Amount KES" className="rounded-lg border px-3 py-2" />
            <input name="dueAt" type="date" className="rounded-lg border px-3 py-2" />
            <textarea name="purpose" required placeholder="Purpose" className="rounded-lg border px-3 py-2 md:col-span-2" rows={3} />
            <textarea name="installmentNotes" placeholder="Installment notes (optional)" className="rounded-lg border px-3 py-2 md:col-span-2" rows={2} />
            <select name="guarantorIds" multiple required className="h-36 rounded-lg border px-2 md:col-span-2">
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
            <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Submit application</button>
          </form>
        </section>

        {guarantorInvites.some((g) => g.status === 'PENDING') && (
          <section className="rounded-2xl border bg-surface p-5">
            <h2 className="font-h3 text-lg text-primary">Guarantor requests</h2>
            <div className="mt-3 space-y-3">
              {guarantorInvites
                .filter((g) => g.status === 'PENDING')
                .map((g) => (
                  <article key={g.id} className="rounded-xl border p-3 text-sm">
                    <b>{g.loan.applicant.fullName}</b> · KES {moneyNumber(g.loan.amountKes).toLocaleString()}
                    <p className="text-on-surface-variant">{g.loan.purpose}</p>
                    <div className="mt-2 flex gap-2">
                      <form action={respondLoanGuarantor}>
                        <input type="hidden" name="guarantorId" value={g.id} />
                        <input type="hidden" name="status" value="ACCEPTED" />
                        <button className="rounded-lg border px-3 py-1.5 text-xs">Accept</button>
                      </form>
                      <form action={respondLoanGuarantor}>
                        <input type="hidden" name="guarantorId" value={g.id} />
                        <input type="hidden" name="status" value="DECLINED" />
                        <button className="rounded-lg border px-3 py-1.5 text-xs">Decline</button>
                      </form>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-lg text-primary">My applications</h2>
          <div className="mt-3 space-y-2 text-sm">
            {mine.map((loan) => (
              <article key={loan.id} className="rounded-xl border p-3">
                <b>KES {moneyNumber(loan.amountKes).toLocaleString()}</b> · {loan.status}
                <p>{loan.purpose}</p>
                <p className="text-xs text-on-surface-variant">
                  Guarantors:{' '}
                  {loan.guarantors.map((g) => `${g.user.fullName} (${g.status})`).join(', ') || '—'}
                  {(loan.status === 'DISBURSED' || loan.status === 'CLOSED') &&
                    ` · outstanding KES ${(balances.get(loan.id) || 0).toLocaleString()}`}
                </p>
              </article>
            ))}
            {!mine.length && <p>No applications yet.</p>}
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
