import Link from 'next/link'
import type { Prisma, TransactionStatus, TransactionType } from '@prisma/client'
import DashboardShell from '@/components/dashboard/DashboardShell'
import LedgerActions from '@/components/finance/LedgerActions'
import PaginationBar from '@/components/ui/PaginationBar'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { accountBalances } from '@/lib/finance'
import { requireActiveRole } from '@/lib/auth/session'
import { canRecordPayments } from '@/lib/finance-access'
import { approveFinancialTransaction, approveReversal, proposeReversal } from '@/app/actions/finance'
import { parsePage, paginationSkip, totalPages } from '@/lib/pagination'
import { formatMonthKeys, formatPaymentMethod, hasChartData, monthKeyFromDate } from '@/lib/chart-labels'
import { ChartEmpty, IncomeExpenseChart, PaymentMethodChart, TopContributorsChart } from '@/components/dashboard/Charts'
import { APP_TIMEZONE } from '@/lib/dates'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Financial ledger' }

const PATH = '/dashboard/treasurer/ledger'
const PAGE_SIZE = 50
const STATUSES: TransactionStatus[] = ['PENDING', 'CONFIRMED', 'RECONCILED', 'REVERSED', 'REJECTED']
const MONEY_IN: TransactionType[] = ['CONTRIBUTION']
const MONEY_OUT: TransactionType[] = ['EXPENSE', 'DISBURSEMENT']
const CORRECTIONS: TransactionType[] = ['REVERSAL', 'ADJUSTMENT', 'TRANSFER', 'OPENING_BALANCE']

type Direction = 'in' | 'out' | 'corrections'
const DIRECTIONS: { key: Direction | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'list' },
  { key: 'in', label: 'Money in', icon: 'south_west' },
  { key: 'out', label: 'Money out', icon: 'north_east' },
  { key: 'corrections', label: 'Corrections', icon: 'sync_alt' },
]
const DIRECTION_TYPES: Record<Direction, TransactionType[]> = { in: MONEY_IN, out: MONEY_OUT, corrections: CORRECTIONS }

type Flow = 'in' | 'out' | 'other'
const flowOf = (type: TransactionType): Flow => (MONEY_IN.includes(type) ? 'in' : MONEY_OUT.includes(type) ? 'out' : 'other')
const FLOW_LABEL: Record<Flow, string> = { in: 'Money in', out: 'Money out', other: 'Correction' }
const FLOW_STYLE: Record<Flow, { icon: string; badge: string; amount: string }> = {
  in: { icon: 'south_west', badge: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300', amount: 'text-green-700 dark:text-green-300' },
  out: { icon: 'north_east', badge: 'bg-error-container text-error', amount: 'text-error' },
  other: { icon: 'sync_alt', badge: 'bg-surface-container-high text-on-surface-variant', amount: 'text-on-surface' },
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const shortDate = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')
const kes = (value: number) => `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`

const STATUS_STYLE: Record<TransactionStatus, string> = {
  PENDING: 'bg-secondary-fixed text-secondary',
  CONFIRMED: 'bg-primary/10 text-primary',
  RECONCILED: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200',
  REVERSED: 'bg-surface-container text-on-surface-variant line-through',
  REJECTED: 'bg-error-container text-error',
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; category?: string; month?: string; dir?: string; status?: string; q?: string; page?: string }>
}) {
  // Admins can open the ledger to review and approve; only the Treasurer records or reverses.
  const actor = await requireActiveRole(['TREASURER'])
  const canRecord = canRecordPayments(actor)
  const canApprove = actor.role === 'ADMIN' || Boolean(actor.isSuperAdmin) || canRecord
  const sp = await searchParams
  const page = parsePage(sp.page)
  const q = (sp.q ?? '').trim()
  const direction = sp.dir && sp.dir in DIRECTION_TYPES ? (sp.dir as Direction) : undefined
  const status = STATUSES.includes(sp.status as TransactionStatus) ? (sp.status as TransactionStatus) : undefined

  // Report range: From/To dates (old ?month=YYYY-MM links still work). No range = all time.
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(sp.month ?? '')
  const fromValue = DATE_RE.test(sp.from ?? '') ? sp.from! : monthMatch ? `${monthMatch[0]}-01` : ''
  const toValue = DATE_RE.test(sp.to ?? '')
    ? sp.to!
    : monthMatch
      ? new Date(Date.UTC(Number(monthMatch[1]), Number(monthMatch[2]), 0)).toISOString().slice(0, 10)
      : ''
  const categoryId = sp.category?.trim() || ''
  const rangeWhere: Prisma.FinancialTransactionWhereInput = {
    ...(fromValue || toValue
      ? { occurredAt: { ...(fromValue ? { gte: new Date(fromValue) } : {}), ...(toValue ? { lte: new Date(`${toValue}T23:59:59.999`) } : {}) } }
      : {}),
    ...(categoryId ? { categoryId } : {}),
  }

  const where: Prisma.FinancialTransactionWhereInput = {
    ...rangeWhere,
    ...(direction ? { type: { in: DIRECTION_TYPES[direction] } } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { transactionNumber: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { providerReference: { contains: q, mode: 'insensitive' } },
            { contribution: { user: { fullName: { contains: q, mode: 'insensitive' } } } },
            { expense: { payee: { contains: q, mode: 'insensitive' } } },
            { disbursement: { beneficiary: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [balances, confirmed, count, transactions, pending, categories, obligations, reconciliations] = await Promise.all([
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
    prisma.financialTransaction.count({ where }),
    prisma.financialTransaction.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip: paginationSkip(page, PAGE_SIZE),
      take: PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        originalTransaction: { select: { transactionNumber: true, description: true } },
        contribution: { select: { paymentMethod: true, user: { select: { fullName: true } } } },
        expense: { select: { payee: true } },
        disbursement: { select: { beneficiary: true } },
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
        user: { select: { fullName: true } },
        campaign: { select: { title: true, contributions: { where: { status: { in: ['CONFIRMED', 'RECONCILED'] } }, select: { userId: true, amount: true } } } },
      },
    }),
    prisma.reconciliation.count({
      where: fromValue || toValue
        ? { reconciledAt: { ...(fromValue ? { gte: new Date(fromValue) } : {}), ...(toValue ? { lte: new Date(`${toValue}T23:59:59.999`) } : {}) } }
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

  const arrears = obligations
    .map((o) => {
      const paid = o.campaign.contributions.filter((c) => c.userId === o.userId).reduce((s, c) => s + c.amount, 0)
      const target = Number(o.targetAmount)
      return { id: o.id, member: o.user.fullName, campaign: o.campaign.title, target, paid, balance: Math.max(0, target - paid) }
    })
    .filter((row) => row.balance > 0)
    .sort((a, b) => b.balance - a.balance)
  const arrearsTotal = arrears.reduce((s, row) => s + row.balance, 0)

  const rangeLabel = fromValue || toValue
    ? `${fromValue ? shortDate(fromValue) : 'Start'} – ${toValue ? shortDate(toValue) : 'today'}`
    : 'All time'
  const reportFiltered = Boolean(fromValue || toValue || categoryId)
  const filtered = Boolean(reportFiltered || direction || status || q)
  const exportHref = `/api/export/financial?from=${fromValue || '2000-01-01'}&to=${toValue || new Date().toISOString().slice(0, 10)}${categoryId ? `&category=${categoryId}` : ''}`

  const historyHref = (next: { dir?: string }) => {
    const params = new URLSearchParams()
    if (fromValue) params.set('from', fromValue)
    if (toValue) params.set('to', toValue)
    if (categoryId) params.set('category', categoryId)
    if (next.dir) params.set('dir', next.dir)
    if (status) params.set('status', status)
    if (q) params.set('q', q)
    const query = params.toString()
    return query ? `${PATH}?${query}` : PATH
  }

  // Group the page by day (group's timezone), with each day's net movement.
  const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(date)
  const days: { key: string; label: string; net: number; rows: typeof transactions }[] = []
  for (const tx of transactions) {
    const key = dayKey(tx.occurredAt)
    let day = days[days.length - 1]
    if (!day || day.key !== key) {
      day = {
        key,
        label: tx.occurredAt.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: APP_TIMEZONE }),
        net: 0,
        rows: [],
      }
      days.push(day)
    }
    day.rows.push(tx)
    if (['CONFIRMED', 'RECONCILED'].includes(tx.status)) {
      const flow = flowOf(tx.type)
      day.net += flow === 'in' ? Number(tx.amount) : flow === 'out' ? -Number(tx.amount) : 0
    }
  }

  return (
    <DashboardShell
      role="TREASURER"
      title="Financial ledger"
      nav={TREASURER_NAV}
      pageAction={
        <div className="flex flex-wrap items-center gap-2">
          <LedgerActions canRecord={canRecord} canManagePurposes={canApprove} />
        </div>
      }
    >
      <div className="space-y-6 p-4 md:p-6">
        {/* Report filters: apply to every figure, chart and the history below. */}
        <form method="get" className="flex flex-wrap items-end gap-2 rounded-2xl border border-outline-variant bg-surface p-3 text-sm">
          <label className="text-xs font-semibold text-on-surface-variant">From
            <input name="from" type="date" defaultValue={fromValue} className="mt-1 block rounded-lg border px-3 py-1.5 text-sm font-normal text-on-surface" />
          </label>
          <label className="text-xs font-semibold text-on-surface-variant">To
            <input name="to" type="date" defaultValue={toValue} className="mt-1 block rounded-lg border px-3 py-1.5 text-sm font-normal text-on-surface" />
          </label>
          <label className="text-xs font-semibold text-on-surface-variant">Purpose
            <select name="category" defaultValue={categoryId} className="mt-1 block rounded-lg border px-3 py-1.5 text-sm font-normal text-on-surface">
              <option value="">All purposes</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button className="h-9 rounded-full bg-primary px-4 font-semibold text-on-primary">Apply</button>
          {reportFiltered && <Link href={PATH} className="h-9 px-2 leading-9 text-primary underline">All time</Link>}
          <div className="ml-auto flex flex-wrap gap-2">
            <a href={exportHref} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3.5 font-semibold text-primary hover:bg-primary/5">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Export CSV
            </a>
            <Link href="/financial-reports/active-months" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3.5 font-semibold text-primary hover:bg-primary/5">
              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
              Active months per member
            </Link>
          </div>
        </form>

        <section>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Account balances · today</h2>
          <div className="grid gap-3 sm:grid-cols-3">
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
            <h2 className="font-h3 text-lg text-primary">Monthly income vs expenditure</h2>
            <p className="text-xs text-on-surface-variant">Confirmed ledger transactions, {rangeLabel.toLowerCase()}.</p>
            <div className="mt-3">
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
            <div className="max-h-80 overflow-auto rounded-xl border border-outline-variant/60">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="sticky top-0 bg-surface-container-low text-left text-[11px] uppercase tracking-wide text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2">Member</th>
                    <th className="px-3 py-2">Campaign</th>
                    <th className="px-3 py-2 text-right">Target</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2 text-right">Owing</th>
                  </tr>
                </thead>
                <tbody>
                  {arrears.map((row) => (
                    <tr key={row.id} className="border-t border-outline-variant/50">
                      <td className="px-3 py-2 font-medium">{row.member}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{row.campaign}</td>
                      <td className="px-3 py-2 text-right">{kes(row.target)}</td>
                      <td className="px-3 py-2 text-right">{kes(row.paid)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-error">{kes(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

        <section className="rounded-2xl border border-outline-variant bg-surface p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-h3 text-lg text-primary">Transaction history</h2>
              <p className="text-xs text-on-surface-variant">
                Every movement of money: payments in, expenses and payouts, and corrections.
              </p>
            </div>
            <p className="text-xs text-on-surface-variant">
              Entries can&apos;t be edited or deleted.{canRecord ? ' Fix a mistake by reversing it with a reason.' : ''}
            </p>
          </div>

          <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Transaction direction">
            {DIRECTIONS.map((d) => {
              const active = (direction ?? 'all') === d.key
              return (
                <Link
                  key={d.key}
                  href={historyHref({ dir: d.key === 'all' ? undefined : d.key })}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                    active ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant hover:bg-primary/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{d.icon}</span>
                  {d.label}
                </Link>
              )
            })}
          </nav>

          <form method="get" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            {direction && <input type="hidden" name="dir" value={direction} />}
            {fromValue && <input type="hidden" name="from" value={fromValue} />}
            {toValue && <input type="hidden" name="to" value={toValue} />}
            {categoryId && <input type="hidden" name="category" value={categoryId} />}
            <select name="status" defaultValue={status ?? ''} className="rounded-lg border px-3 py-1.5" aria-label="Status">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
            <input name="q" defaultValue={q} placeholder="Search name, description or reference" className="min-w-[14rem] flex-1 rounded-lg border px-3 py-1.5" />
            <button className="rounded-full bg-primary px-4 py-1.5 text-on-primary">Search</button>
            {filtered && <Link href={PATH} className="text-primary underline">Clear</Link>}
          </form>

          {transactions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant py-10 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[36px] text-primary/30">receipt_long</span>
              <p className="text-sm">
                {filtered
                  ? 'No transactions match these filters.'
                  : direction === 'out'
                    ? 'No money has been paid out yet. Expenses, loan and welfare payouts appear here once recorded.'
                    : 'No transactions recorded yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {days.map((day) => (
                <div key={day.key}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                    <span>{day.label}</span>
                    <span className={day.net >= 0 ? 'text-green-700 dark:text-green-300' : 'text-error'}>
                      {day.net >= 0 ? '+' : '−'}{kes(Math.abs(day.net))}
                    </span>
                  </div>
                  <ul className="divide-y divide-outline-variant/50 rounded-xl border border-outline-variant/60">
                    {day.rows.map((tx) => {
                      const amount = Number(tx.amount)
                      const flow = flowOf(tx.type)
                      const party = tx.contribution?.user.fullName ?? tx.expense?.payee ?? tx.disbursement?.beneficiary ?? null
                      const details = [
                        tx.category?.name ?? FLOW_LABEL[flow],
                        party && tx.description !== party ? tx.description : null,
                        tx.contribution ? formatPaymentMethod(tx.contribution.paymentMethod) : null,
                        tx.providerReference ? `Ref ${tx.providerReference}` : null,
                      ].filter(Boolean)
                      const inactive = tx.status === 'REVERSED' || tx.status === 'REJECTED'
                      return (
                        <li key={tx.id} className={`relative flex flex-wrap items-center gap-3 px-3 py-3 ${inactive ? 'opacity-60' : ''}`}>
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${FLOW_STYLE[flow].badge}`}>
                            <span className="material-symbols-outlined text-[20px]">{FLOW_STYLE[flow].icon}</span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold text-on-surface">{party ?? tx.description}</p>
                            <p className="truncate text-xs text-on-surface-variant">{details.join(' · ')}</p>
                            {tx.originalTransaction && (
                              <p className="truncate text-xs text-on-surface-variant">Reverses: {tx.originalTransaction.description}</p>
                            )}
                            {tx.correctionReason && <p className="truncate text-xs text-on-surface-variant">Reason: {tx.correctionReason}</p>}
                            <p className="text-[11px] text-outline">Recorded by {tx.createdBy.fullName}</p>
                          </div>
                          <div className="ml-auto flex flex-col items-end gap-1 text-right">
                            <span className={`whitespace-nowrap text-[15px] font-bold ${FLOW_STYLE[flow].amount} ${tx.status === 'REVERSED' ? 'line-through' : ''}`}>
                              {flow === 'in' ? '+' : flow === 'out' ? '−' : ''}{kes(amount)}
                            </span>
                            <span className="flex flex-wrap justify-end gap-1">
                              {tx.status !== 'CONFIRMED' && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[tx.status]}`}>{label(tx.status)}</span>
                              )}
                              {tx.addedAfterClose && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Added after close</span>}
                              {tx.editedAfterClose && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">Edited after close</span>}
                            </span>
                          </div>
                          {canRecord && ['CONFIRMED', 'RECONCILED'].includes(tx.status) && (
                            <details className="w-full sm:w-auto">
                              <summary
                                title="Reverse this entry"
                                className="flex h-8 w-fit cursor-pointer list-none items-center gap-1 rounded-full border border-outline-variant px-2.5 text-xs font-semibold text-error hover:bg-error/5 [&::-webkit-details-marker]:hidden"
                              >
                                <span className="material-symbols-outlined text-[16px]">undo</span>
                                <span className="sm:hidden">Reverse</span>
                              </summary>
                              <form action={proposeReversal} className="mt-2 flex gap-1.5 sm:absolute sm:right-3 sm:top-full sm:z-10 sm:mt-0 sm:w-80 sm:rounded-xl sm:border sm:border-outline-variant sm:bg-surface sm:p-2 sm:shadow-lg">
                                <input type="hidden" name="id" value={tx.id} />
                                <input name="reason" required minLength={5} placeholder="Why reverse this? (at least 5 characters)" className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-xs" />
                                <button className="rounded-full bg-error px-3 py-1.5 text-xs font-semibold text-on-error">Propose</button>
                              </form>
                            </details>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-on-surface-variant">{count.toLocaleString()} transaction{count === 1 ? '' : 's'}</p>
          <PaginationBar
            pathname={PATH}
            page={page}
            totalPages={totalPages(count, PAGE_SIZE)}
            params={{ from: fromValue || undefined, to: toValue || undefined, category: categoryId || undefined, dir: direction, status, q: q || undefined }}
          />
        </section>
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
