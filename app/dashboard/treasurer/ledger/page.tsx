import IconModalButton from '@/components/ui/IconModalButton'
import { rangeFilter, resolveTimeRange } from '@/lib/time-range'
import ArrearsTable, { type ArrearsRow } from '@/components/finance/ArrearsTable'
import LedgerFilters from '@/components/finance/LedgerFilters'
import { APP_TIMEZONE, appTodayInputValue } from '@/lib/dates'
import FinancialRequestsHistory from '@/components/finance/FinancialRequestsHistory'
import type { Prisma } from '@prisma/client'
import DashboardShell from '@/components/dashboard/DashboardShell'
import LedgerActions from '@/components/finance/LedgerActions'
import LedgerHistoryModal from '@/components/finance/LedgerHistoryModal'
import LedgerHistory from '@/components/finance/LedgerHistory'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { accountBalances } from '@/lib/finance'
import { requireActiveRole } from '@/lib/auth/session'
import { canRecordPayments } from '@/lib/finance-access'
import { approveFinancialTransaction, approveReversal } from '@/app/actions/finance'
import { formatMonthKeys, formatPaymentMethod, hasChartData, monthKeyFromDate } from '@/lib/chart-labels'
import { ChartEmpty, IncomeExpenseChart, PaymentMethodChart, TopContributorsChart } from '@/components/dashboard/Charts'
import { MONEY_IN, MONEY_OUT, normaliseLedgerFilters } from '@/lib/ledger-history'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Financial ledger' }

const PATH = '/dashboard/treasurer/ledger'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')
const kes = (value: number) => `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; category?: string; month?: string; dir?: string; status?: string; q?: string; page?: string; history?: string }>
}) {
  // Admins can open the ledger to review and approve; only the Treasurer records or reverses.
  const actor = await requireActiveRole(['TREASURER'])
  const canRecord = canRecordPayments(actor)
  const canApprove = actor.role === 'ADMIN' || Boolean(actor.isSuperAdmin) || canRecord
  const sp = await searchParams
  // Old ?history=1&dir=…&status=…&q=… links open the history with those filters applied.
  const { dir: direction, status, q } = normaliseLedgerFilters({ dir: sp.dir, status: sp.status, q: sp.q })
  const historyOpen = sp.history === '1'

  // Report range: From/To dates (old ?month=YYYY-MM links still work). No range = all time.
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(sp.month ?? '')
  const rawFrom = DATE_RE.test(sp.from ?? '') ? sp.from! : monthMatch ? `${monthMatch[0]}-01` : ''
  const rawTo = DATE_RE.test(sp.to ?? '')
    ? sp.to!
    : monthMatch
      ? new Date(Date.UTC(Number(monthMatch[1]), Number(monthMatch[2]), 0)).toISOString().slice(0, 10)
      : ''
  const swapped = Boolean(rawFrom && rawTo && rawFrom > rawTo)
  // One time filter: Last 24 hours (exact hours), presets, or custom dates in Nairobi time.
  const period = resolveTimeRange({ range: monthMatch ? 'custom' : sp.range, from: rawFrom, to: rawTo })
  const periodFilter = rangeFilter(period)
  const fromValue = period.from
  const toValue = period.to
  const categoryId = sp.category?.trim() || ''
  const rangeWhere: Prisma.FinancialTransactionWhereInput = {
    ...(periodFilter ? { occurredAt: periodFilter } : {}),
    ...(categoryId ? { categoryId } : {}),
  }

  const [balances, confirmed, pending, categories, obligations, reconciliations] = await Promise.all([
    accountBalances(),
    // Every confirmed movement in the range — the source for totals, charts and breakdowns.
    prisma.financialTransaction.findMany({
      where: { ...rangeWhere, status: { in: ['CONFIRMED', 'RECONCILED'] } },
      select: {
        type: true,
        amount: true,
        occurredAt: true,
        category: { select: { name: true } },
        contribution: { select: { paymentMethod: true, userId: true, user: { select: { fullName: true } } } },
      },
    }),
    prisma.financialTransaction.findMany({
      where: { status: 'PENDING' },
      orderBy: { occurredAt: 'desc' },
      take: 50,
      include: {
        category: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        originalTransaction: { select: { transactionNumber: true } },
      },
    }),
    prisma.transactionCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.memberContributionObligation.findMany({
      where: { status: { in: ['OUTSTANDING', 'PARTIALLY_PAID'] } },
      include: {
        user: { select: { fullName: true, membershipNumber: true, email: true, phone: true, standing: true, contributionPlan: true } },
        campaign: {
          select: {
            title: true, description: true, startsAt: true, dueAt: true,
            category: { select: { name: true } },
            contributions: {
              where: { status: { in: ['CONFIRMED', 'RECONCILED', 'PENDING'] } },
              select: { id: true, userId: true, amount: true, status: true, paidAt: true, paymentMethod: true, mpesaRef: true },
              orderBy: { paidAt: 'desc' },
            },
          },
        },
      },
    }),
    prisma.reconciliation.count({
      where: periodFilter
        ? { reconciledAt: periodFilter }
        : {},
    }),
  ])

  // ── Report figures for the range ──
  const moneyIn = confirmed.filter((t) => MONEY_IN.includes(t.type)).reduce((s, t) => s + Number(t.amount), 0)
  const moneyOut = confirmed.filter((t) => MONEY_OUT.includes(t.type)).reduce((s, t) => s + Number(t.amount), 0)
  const payments = confirmed.filter((t) => MONEY_IN.includes(t.type))
  const contributors = new Set(payments.map((t) => t.contribution?.userId).filter(Boolean)).size
  const averagePayment = payments.length ? moneyIn / payments.length : 0
  const largestPayment = payments.reduce((max, t) => Math.max(max, Number(t.amount)), 0)

  const monthly = new Map<string, { income: number; expense: number }>()
  for (const tx of confirmed) {
    const key = monthKeyFromDate(tx.occurredAt)
    const entry = monthly.get(key) ?? { income: 0, expense: 0 }
    if (MONEY_IN.includes(tx.type)) entry.income += Number(tx.amount)
    else if (MONEY_OUT.includes(tx.type)) entry.expense += Number(tx.amount)
    monthly.set(key, entry)
  }
  const chartKeys = [...monthly.keys()].sort()
  const chartIncome = chartKeys.map((k) => monthly.get(k)!.income)
  const chartExpense = chartKeys.map((k) => monthly.get(k)!.expense)

  const sumBy = (rows: typeof confirmed, key: (t: (typeof confirmed)[number]) => string) => {
    const map = new Map<string, number>()
    for (const t of rows) map.set(key(t), (map.get(key(t)) ?? 0) + Number(t.amount))
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }
  const byMethod = sumBy(payments, (t) => formatPaymentMethod(t.contribution?.paymentMethod))
  const incomeByPurpose = sumBy(payments, (t) => t.category?.name ?? 'Uncategorised')
  const spendingByPurpose = sumBy(confirmed.filter((t) => MONEY_OUT.includes(t.type)), (t) => t.category?.name ?? 'Uncategorised')
  const topContributors = sumBy(payments.filter((t) => t.contribution), (t) => t.contribution!.user.fullName).slice(0, 8)

  const nowMs = Date.now()
  const arrears: ArrearsRow[] = obligations
    .map((o) => {
      const own = o.campaign.contributions.filter((c) => c.userId === o.userId)
      // Only confirmed payments reduce what is owed; pending ones are listed in the details.
      const paid = own.filter((c) => c.status !== 'PENDING').reduce((s, c) => s + c.amount, 0)
      const target = Number(o.targetAmount)
      const due = o.campaign.dueAt
      const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: APP_TIMEZONE })
      return {
        id: o.id,
        member: o.user.fullName,
        membershipNumber: o.user.membershipNumber,
        email: o.user.email,
        phone: o.user.phone,
        standing: o.user.standing,
        plan: o.user.contributionPlan,
        campaign: o.campaign.title,
        campaignPurpose: o.campaign.category.name,
        campaignDescription: o.campaign.description,
        startsAt: dayLabel(o.campaign.startsAt),
        dueAt: due ? dayLabel(due) : null,
        overdueDays: due && due.getTime() < nowMs ? Math.max(1, Math.floor((nowMs - due.getTime()) / 86_400_000)) : null,
        status: o.status,
        target,
        paid,
        balance: Math.max(0, target - paid),
        payments: own.map((c) => ({ id: c.id, date: dayLabel(c.paidAt), amount: c.amount, method: formatPaymentMethod(c.paymentMethod), reference: c.mpesaRef, status: c.status })),
      }
    })
    .filter((row) => row.balance > 0)
    .sort((a, b) => b.balance - a.balance)
  const arrearsTotal = arrears.reduce((s, row) => s + row.balance, 0)

  const rangeLabel = period.label
  // The export gets exact instants, so "Last 24 hours" downloads exactly what is shown.
  const exportHref = `/api/export/financial?from=${encodeURIComponent(period.gte?.toISOString() ?? '2000-01-01')}&to=${encodeURIComponent(period.lte?.toISOString() ?? new Date().toISOString())}${categoryId ? `&category=${categoryId}` : ''}`

  const rangeParams = () => {
    const params = new URLSearchParams()
    if (period.key !== 'all' && period.key !== 'custom') params.set('range', period.key)
    if (period.key === 'custom' && fromValue) params.set('from', fromValue)
    if (period.key === 'custom' && toValue) params.set('to', toValue)
    if (categoryId) params.set('category', categoryId)
    return params
  }
  const withQuery = (params: URLSearchParams) => (params.toString() ? `${PATH}?${params.toString()}` : PATH)
  // Opening keeps the report range; closing drops the history's own filters.
  const closeHistoryHref = withQuery(rangeParams())

  return (
    <DashboardShell
      role="TREASURER"
      title="Financial ledger"
      nav={TREASURER_NAV}
      pageSecondRow={(
        <div className="flex flex-wrap items-end gap-2 text-sm lg:flex-nowrap">
          <LedgerFilters key={`${period.key}|${fromValue}|${toValue}`} range={period.key} from={fromValue} to={toValue} today={appTodayInputValue()} categories={categories.map(c => ({ id: c.id, name: c.name }))} category={categoryId} />
          <div className="contents">
            <IconModalButton icon="volunteer_activism" label="Loans & welfare" title="Loan and welfare history" size="xl" showText variant="primary"><FinancialRequestsHistory /></IconModalButton>
        <LedgerHistoryModal open={historyOpen} closeHref={closeHistoryHref}>
          <LedgerHistory range={period.key} from={fromValue} to={toValue} category={categoryId} canRecord={canRecord} initialDirection={direction ?? 'all'} initialStatus={status ?? ''} initialQuery={q} key={`${period.key}|${fromValue}|${toValue}|${categoryId}`} />
        </LedgerHistoryModal>
            <a href={exportHref} className="inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-outline-variant px-2.5 text-xs font-semibold text-primary hover:bg-primary/5">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Export CSV
            </a>
          </div>
        </div>
      )}
      pageAction={
        <div className="flex flex-wrap items-center gap-2">
          <LedgerActions canRecord={canRecord} canManagePurposes={canApprove} />
        </div>
      }
    >
      <div className="space-y-6 p-4 md:p-6">
        {/* Report filters: apply to every figure, chart and the history below. */}


        <section>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Account balances · today</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {/* Everything held right now across every account and payment reason; drops when money is paid out. */}
            <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
              <p className="text-xs font-bold uppercase text-primary">Total funds · all accounts</p>
              <p className="mt-1 text-2xl font-bold text-primary">{kes(balances.filter((a) => a.type === 'ASSET').reduce((sum, a) => sum + a.balance, 0))}</p>
              <p className="mt-0.5 text-[11px] text-on-surface-variant">Bank + cash + M-Pesa, after money paid out</p>
            </div>
            {balances.filter((a) => a.type === 'ASSET').map((a) => (
              <div key={a.id} className="rounded-xl border border-outline-variant bg-surface p-4">
                <p className="text-xs uppercase text-on-surface-variant">{a.name}</p>
                <p className="mt-1 text-2xl font-semibold text-on-surface">{kes(a.balance)}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{rangeLabel} · confirmed money</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Money in" value={kes(moneyIn)} tone="text-green-700 dark:text-green-300" icon="south_west" />
            <Stat label="Money out" value={kes(moneyOut)} tone="text-error" icon="north_east" />
            <Stat label="Net movement" value={`${moneyIn - moneyOut < 0 ? '−' : ''}${kes(Math.abs(moneyIn - moneyOut))}`} tone="text-on-surface" icon="balance" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
            <MiniStat label="Payments received" value={payments.length.toLocaleString()} />
            <MiniStat label="Members who paid" value={contributors.toLocaleString()} />
            <MiniStat label="Average payment" value={kes(Math.round(averagePayment))} />
            <MiniStat label="Largest payment" value={kes(largestPayment)} />
            <MiniStat label="Reconciliations" value={reconciliations.toLocaleString()} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-outline-variant bg-surface p-4 lg:col-span-2">
            <h2 className="font-h3 text-lg text-primary">Income vs expenditure</h2>
            <p className="text-xs text-on-surface-variant">
              Confirmed ledger transactions, {rangeLabel.toLowerCase()}.
              {swapped && ' (From and To were the wrong way round, so they were swapped.)'}
            </p>
            <IncomeExpenseCompare income={moneyIn} expense={moneyOut} />
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Month by month</p>
              {hasChartData(chartIncome) || hasChartData(chartExpense) ? (
                <IncomeExpenseChart labels={formatMonthKeys(chartKeys)} income={chartIncome} expense={chartExpense} />
              ) : (
                <ChartEmpty message="No confirmed transactions in this range." />
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-outline-variant bg-surface p-4">
            <h2 className="font-h3 text-lg text-primary">Money in by method</h2>
            <p className="text-xs text-on-surface-variant">M-Pesa, bank, cash and other.</p>
            <div className="mt-3">
              {byMethod.length ? (
                <PaymentMethodChart labels={byMethod.map(([name]) => name)} values={byMethod.map(([, value]) => value)} />
              ) : (
                <ChartEmpty message="No payments in this range." />
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Breakdown title="Income by purpose" rows={incomeByPurpose} total={moneyIn} tone="bg-green-600" empty="No income in this range." />
          <Breakdown title="Spending by purpose" rows={spendingByPurpose} total={moneyOut} tone="bg-error" empty="No money paid out in this range." />
          <div className="rounded-2xl border border-outline-variant bg-surface p-4">
            <h2 className="font-h3 text-lg text-primary">Top contributors</h2>
            <div className="mt-3">
              {topContributors.length ? (
                <TopContributorsChart labels={topContributors.map(([name]) => name)} values={topContributors.map(([, value]) => value)} />
              ) : (
                <ChartEmpty message="No member payments in this range." />
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-h3 text-lg text-primary">Arrears</h2>
              <p className="text-xs text-on-surface-variant">Members still owing on active campaigns.</p>
            </div>
            <p className="text-sm">
              <span className="text-on-surface-variant">Outstanding: </span>
              <b className="text-error">{kes(arrearsTotal)}</b>
              <span className="text-on-surface-variant"> · {arrears.length} member{arrears.length === 1 ? '' : 's'}</span>
            </p>
          </div>
          {arrears.length === 0 ? (
            <p className="rounded-xl border border-dashed border-outline-variant py-6 text-center text-sm text-on-surface-variant">Nobody is behind on a campaign.</p>
          ) : (
            <ArrearsTable rows={arrears} />
          )}
        </section>

        {pending.length > 0 && (
          <section id="approvals" className="rounded-2xl border border-secondary-container/50 bg-surface p-4">
            <h2 className="font-h3 text-lg text-primary">Waiting for approval ({pending.length})</h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Entries and reversals need a second person: whoever recorded one can&apos;t approve it.
            </p>
            <ul className="mt-3 divide-y divide-outline-variant/60">
              {pending.map((tx) => {
                const own = tx.createdById === actor.id
                return (
                  <li key={tx.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-on-surface">
                        {label(tx.type)} · {kes(Number(tx.amount))}
                        {tx.originalTransaction && <span className="font-normal text-on-surface-variant"> · reverses {tx.originalTransaction.transactionNumber}</span>}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {tx.description} · {tx.category?.name || 'No category'} · {tx.occurredAt.toLocaleDateString()} · by {tx.createdBy.fullName}
                      </p>
                      {tx.correctionReason && <p className="text-xs text-on-surface-variant">Reason: {tx.correctionReason}</p>}
                    </div>
                    {canApprove && !own && (
                      <form action={tx.type === 'REVERSAL' ? approveReversal : approveFinancialTransaction}>
                        <input type="hidden" name="id" value={tx.id} />
                        <button className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-on-primary">
                          Approve {tx.type === 'REVERSAL' ? 'reversal' : ''}
                        </button>
                      </form>
                    )}
                    {own && <span className="text-xs text-on-surface-variant">You recorded this — someone else must approve</span>}
                  </li>
                )
              })}
            </ul>
          </section>
        )}


      </div>

    </DashboardShell>
  )
}

function Stat({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface p-4">
      <span className={`material-symbols-outlined rounded-full bg-surface-container-low p-2 text-[20px] ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs uppercase text-on-surface-variant">{label}</p>
        <p className={`mt-0.5 truncate text-2xl font-semibold ${tone}`}>{value}</p>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="truncate text-base font-semibold text-on-surface">{value}</p>
    </div>
  )
}

/** Ranked list with a proportional bar for each purpose. */
function Breakdown({ title, rows, total, tone, empty }: { title: string; rows: [string, number][]; total: number; tone: string; empty: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface p-4">
      <h2 className="font-h3 text-lg text-primary">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-outline-variant py-6 text-center text-sm text-on-surface-variant">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map(([name, amount]) => {
            const share = total > 0 ? Math.round((amount / total) * 100) : 0
            return (
              <li key={name} className="text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium text-on-surface">{name}</span>
                  <span className="whitespace-nowrap text-on-surface-variant">
                    <b className="text-on-surface">{kes(amount)}</b> · {share}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(share, 2)}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Income and expenditure figures with a side-by-side bar comparison and the net result. */
function IncomeExpenseCompare({ income, expense }: { income: number; expense: number }) {
  const largest = Math.max(income, expense, 1)
  const net = income - expense
  const rows = [
    { label: 'Income', value: income, bar: 'bg-green-600', text: 'text-green-700 dark:text-green-300', icon: 'south_west' },
    { label: 'Expenditure', value: expense, bar: 'bg-error', text: 'text-error', icon: 'north_east' },
  ]
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="flex items-center gap-1 font-semibold text-on-surface">
              <span className={`material-symbols-outlined text-[16px] ${row.text}`}>{row.icon}</span>
              {row.label}
            </span>
            <span className={`text-lg font-bold ${row.text}`}>{kes(row.value)}</span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-surface-container-high">
            <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${row.value > 0 ? Math.max((row.value / largest) * 100, 2) : 0}%` }} />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/50 pt-2 text-sm">
        <span className="text-on-surface-variant">
          {income === 0 && expense === 0
            ? 'No confirmed money in or out in this range.'
            : expense === 0
              ? 'Nothing spent in this range.'
              : `Spent ${Math.round((expense / Math.max(income, 1)) * 100)}% of income`}
        </span>
        <span className={`font-bold ${net >= 0 ? 'text-green-700 dark:text-green-300' : 'text-error'}`}>
          Net {net >= 0 ? '+' : '−'}{kes(Math.abs(net))}
        </span>
      </div>
    </div>
  )
}












