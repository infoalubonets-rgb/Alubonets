import DashboardShell from '@/components/dashboard/DashboardShell'
import ModuleDisabled from '@/components/dashboard/ModuleDisabled'
import LoanApplicationForm from '@/components/dashboard/LoanApplicationForm'
import LoanHistoryTable from '@/components/dashboard/LoanHistoryTable'
import LoanSubmitFeedback from '@/components/dashboard/LoanSubmitFeedback'
import { requireActiveRole } from '@/lib/auth/session'
import { MEMBER_NAV, LOANS_NAV_ITEMS, withOptionalNav, navForRole } from '@/lib/dashboard/nav'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/feature-flags'
import { getLoanPolicy } from '@/lib/settings'
import { loanBalancesForIds, moneyNumber } from '@/lib/loans'
import { prisma } from '@/lib/prisma'
import { toDateInputValue, tomorrowInputValue } from '@/lib/dates'
import { respondLoanGuarantor, submitLoanApplication } from '@/app/actions/loans'

export default async function MemberLoansPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  if (!(await isFeatureEnabled(FEATURE_FLAGS.loansEnabled))) return <ModuleDisabled module="Loans" />
  const actor = await requireActiveRole(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'])
  const policy = await getLoanPolicy()
  const feedback = await searchParams
  const [mine, guarantorInvites, members] = await Promise.all([
    prisma.loanApplication.findMany({ where: { applicantId: actor.id }, include: { guarantors: { include: { user: { select: { fullName: true } } } } }, orderBy: { createdAt: 'desc' } }),
    prisma.loanGuarantor.findMany({ where: { userId: actor.id, status: 'PENDING' }, include: { loan: { include: { applicant: { select: { fullName: true } } } } }, orderBy: { createdAt: 'desc' } }),
    prisma.user.findMany({ where: { status: 'ACTIVE', id: { not: actor.id } }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
  ])
  const balances = await loanBalancesForIds(mine.map((loan) => loan.id))
  const nav = withOptionalNav(navForRole(actor.role), LOANS_NAV_ITEMS.member, '/contributions')
  const pendingCount = mine.filter((loan) => ['SUBMITTED', 'UNDER_REVIEW'].includes(loan.status)).length
  const activeCount = mine.filter((loan) => ['APPROVED', 'DISBURSED'].includes(loan.status)).length
  const requestedTotal = mine.reduce((sum, loan) => sum + moneyNumber(loan.amountKes), 0)
  const money = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 })
  const latestDueDate = new Date(); latestDueDate.setFullYear(latestDueDate.getFullYear() + 5)

  return <DashboardShell role={actor.role} title="Loans" nav={nav.length ? nav : withOptionalNav(MEMBER_NAV, LOANS_NAV_ITEMS.member)}>
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon="request_quote" label="All applications" value={String(mine.length)} />
        <SummaryCard icon="pending_actions" label="Awaiting review" value={String(pendingCount)} detail={`${activeCount} approved or active`} />
        <SummaryCard icon="account_balance_wallet" label="Total requested" value={money.format(requestedTotal)} />
      </section>

      {guarantorInvites.length > 0 && <section className="rounded-3xl border border-outline-variant bg-surface p-5 shadow-sm md:p-6">
        <div className="mb-4 flex items-center gap-3"><Icon name="handshake" /><div><h2 className="font-bold text-on-surface">Guarantor requests</h2><p className="text-xs text-on-surface-variant">Review requests from members who selected you as a guarantor.</p></div></div>
        <div className="grid gap-3 md:grid-cols-2">{guarantorInvites.map((invite) => <article key={invite.id} className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 text-sm">
          <p className="font-bold text-on-surface">{invite.loan.applicant.fullName} · KES {moneyNumber(invite.loan.amountKes).toLocaleString()}</p><p className="mt-1 text-on-surface-variant">{invite.loan.purpose}</p>
          <div className="mt-3 flex gap-2">{(['ACCEPTED', 'DECLINED'] as const).map((status) => <form key={status} action={respondLoanGuarantor}><input type="hidden" name="guarantorId" value={invite.id} /><input type="hidden" name="status" value={status} /><button className={status === 'ACCEPTED' ? 'rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary' : 'rounded-xl border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface'}>{status === 'ACCEPTED' ? 'Accept' : 'Decline'}</button></form>)}</div>
        </article>)}</div>
      </section>}

      <section className="rounded-3xl border border-outline-variant bg-surface p-5 shadow-sm md:p-6">
        <div className="mb-5 flex items-center gap-3"><Icon name="request_quote" /><div><h2 className="font-bold text-on-surface">Apply for a loan</h2><p className="text-xs text-on-surface-variant">Complete the request below for Treasurer review.</p></div></div>
        <LoanSubmitFeedback submitted={feedback.submitted === '1'} />
        <LoanApplicationForm action={submitLoanApplication} minAmount={policy.minAmountKes} maxAmount={policy.maxAmountKes} members={members} minDueDate={tomorrowInputValue()} maxDueDate={toDateInputValue(latestDueDate)} />
      </section>

      <section className="rounded-3xl border border-outline-variant bg-surface p-5 shadow-sm md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-bold text-on-surface">Application history</h2><span className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant">{mine.length}</span></div>
        <LoanHistoryTable applications={mine.map((loan) => ({ id: loan.id, amountKes: moneyNumber(loan.amountKes), purpose: loan.purpose, status: loan.status, dueAt: loan.dueAt?.toISOString() ?? null, installmentNotes: loan.installmentNotes, treasurerNote: loan.treasurerNote, decisionNote: loan.decisionNote, createdAt: loan.createdAt.toISOString(), outstandingKes: balances.get(loan.id) || 0, guarantors: loan.guarantors.map((guarantor) => ({ name: guarantor.user?.fullName || `${guarantor.fullName} · ID ${guarantor.idNumber} · ${guarantor.phone}`, status: guarantor.userId ? guarantor.status : 'DETAILS SUPPLIED' })) }))} />
      </section>
    </div>
  </DashboardShell>
}

function Icon({ name }: { name: string }) { return <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><span className="material-symbols-outlined">{name}</span></span> }
function SummaryCard({ icon, label, value, detail }: { icon: string; label: string; value: string; detail?: string }) { return <div className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface p-4 shadow-sm"><Icon name={icon} /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</p><p className="truncate text-lg font-black text-on-surface">{value}</p>{detail && <p className="text-[10px] text-on-surface-variant">{detail}</p>}</div></div> }
