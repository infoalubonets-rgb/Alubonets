import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { APP_TIMEZONE, appDayRange, appTodayInputValue } from '@/lib/dates'
import { formatPaymentMethod } from '@/lib/chart-labels'

/** The reports on the Financial reports page; each can be viewed, filtered and downloaded. */
export const REPORT_KINDS = [
  { key: 'monthly', label: 'Member contributions per month' },
  { key: 'arrears', label: 'Arrears' },
  { key: 'transactions', label: 'All transactions' },
] as const
export type ReportKind = (typeof REPORT_KINDS)[number]['key']

export type ReportFilters = { kind: ReportKind; year: number; from: string; to: string; direction: 'all' | 'in' | 'out'; campaign: string }

export type Report = {
  kind: ReportKind
  title: string
  subtitle: string
  kpis: { label: string; value: string }[]
  columns: { label: string; align?: 'right' }[]
  rows: string[][]
  totals?: string[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const kes = (value: number) => `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`
const num = (value: number) => (value ? value.toLocaleString('en-KE', { maximumFractionDigits: 2 }) : '0')
const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: APP_TIMEZONE })
const monthIndex = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit' })
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, i, 1)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }))

/** Reads report filters from query values, with safe defaults (contributions per month, this year). */
export function parseReportFilters(sp: Record<string, string | undefined>): ReportFilters {
  const thisYear = Number(appTodayInputValue().slice(0, 4))
  const kind = REPORT_KINDS.some((k) => k.key === sp.report) ? (sp.report as ReportKind) : 'monthly'
  const year = Number(sp.year)
  let from = DATE_RE.test(sp.from ?? '') ? sp.from! : ''
  let to = DATE_RE.test(sp.to ?? '') ? sp.to! : ''
  if (from && to && from > to) [from, to] = [to, from]
  return {
    kind,
    year: Number.isInteger(year) && year >= 2000 && year <= thisYear + 1 ? year : thisYear,
    from,
    to,
    direction: sp.direction === 'in' || sp.direction === 'out' ? sp.direction : 'all',
    campaign: sp.campaign?.trim() ?? '',
  }
}

export async function buildReport(filters: ReportFilters): Promise<Report> {
  if (filters.kind === 'arrears') return arrearsReport(filters)
  if (filters.kind === 'transactions') return transactionsReport(filters)
  return monthlyReport(filters)
}

async function monthlyReport({ year }: ReportFilters): Promise<Report> {
  const [members, contributions] = await Promise.all([
    prisma.user.findMany({ where: { status: { not: 'PENDING' } }, select: { id: true, fullName: true, membershipNumber: true }, orderBy: { fullName: 'asc' } }),
    prisma.contribution.findMany({
      where: { status: { in: ['CONFIRMED', 'RECONCILED'] }, paidAt: { gte: appDayRange(`${year}-01-01`).start, lte: appDayRange(`${year}-12-31`).end } },
      select: { userId: true, amount: true, paidAt: true },
    }),
  ])
  const grid = new Map<string, number[]>()
  for (const c of contributions) {
    const row = grid.get(c.userId) ?? Array(12).fill(0)
    row[Number(monthIndex.format(c.paidAt).slice(5, 7)) - 1] += c.amount
    grid.set(c.userId, row)
  }
  const monthTotals = Array.from({ length: 12 }, (_, i) => [...grid.values()].reduce((s, r) => s + r[i], 0))
  const total = monthTotals.reduce((s, v) => s + v, 0)
  const payers = grid.size
  const best = monthTotals.reduce((b, v, i) => (v > monthTotals[b] ? i : b), 0)
  return {
    kind: 'monthly',
    title: 'Member contributions per month',
    subtitle: `${year} · confirmed payments by the month they were paid (KES)`,
    kpis: [
      { label: 'Collected', value: kes(total) },
      { label: 'Members who paid', value: `${payers} of ${members.length}` },
      { label: 'Average per paying member', value: kes(payers ? total / payers : 0) },
      { label: 'Best month', value: total ? `${MONTHS[best]} · ${kes(monthTotals[best])}` : '—' },
    ],
    columns: [{ label: 'Member' }, ...MONTHS.map((m) => ({ label: m, align: 'right' as const })), { label: 'Total', align: 'right' }, { label: 'Months', align: 'right' }],
    rows: members.map((m) => {
      const cells = grid.get(m.id) ?? Array(12).fill(0)
      const sum = cells.reduce((s, v) => s + v, 0)
      return [`${m.fullName}${m.membershipNumber ? ` (${m.membershipNumber})` : ''}`, ...cells.map((v) => (v ? num(v) : '—')), num(sum), `${cells.filter((v) => v > 0).length}/12`]
    }),
    totals: ['Month total', ...monthTotals.map(num), num(total), ''],
  }
}

async function arrearsReport({ campaign }: ReportFilters): Promise<Report> {
  const obligations = await prisma.memberContributionObligation.findMany({
    where: { status: { in: ['OUTSTANDING', 'PARTIALLY_PAID'] }, ...(campaign ? { campaignId: campaign } : {}) },
    include: {
      user: { select: { fullName: true, membershipNumber: true } },
      campaign: { select: { title: true, dueAt: true, contributions: { where: { status: { in: ['CONFIRMED', 'RECONCILED'] } }, select: { userId: true, amount: true } } } },
    },
  })
  const now = Date.now()
  const rows = obligations
    .map((o) => {
      const paid = o.campaign.contributions.filter((c) => c.userId === o.userId).reduce((s, c) => s + c.amount, 0)
      const target = Number(o.targetAmount)
      const overdue = Boolean(o.campaign.dueAt && o.campaign.dueAt.getTime() < now)
      return { member: o.user.fullName, number: o.user.membershipNumber, campaign: o.campaign.title, due: o.campaign.dueAt, target, paid, owing: Math.max(0, target - paid), overdue }
    })
    .filter((r) => r.owing > 0)
    .sort((a, b) => b.owing - a.owing)
  const owing = rows.reduce((s, r) => s + r.owing, 0)
  return {
    kind: 'arrears',
    title: 'Arrears',
    subtitle: 'Members still owing on campaigns (KES)',
    kpis: [
      { label: 'Total owing', value: kes(owing) },
      { label: 'Members owing', value: String(new Set(rows.map((r) => r.member)).size) },
      { label: 'Overdue', value: String(rows.filter((r) => r.overdue).length) },
      { label: 'Already paid toward these', value: kes(rows.reduce((s, r) => s + r.paid, 0)) },
    ],
    columns: [{ label: 'Member' }, { label: 'Campaign' }, { label: 'Due' }, { label: 'Target', align: 'right' }, { label: 'Paid', align: 'right' }, { label: 'Owing', align: 'right' }, { label: 'Status' }],
    rows: rows.map((r) => [
      `${r.member}${r.number ? ` (${r.number})` : ''}`, r.campaign, r.due ? day(r.due) : '—', num(r.target), num(r.paid), num(r.owing), r.overdue ? 'Overdue' : 'Open',
    ]),
    totals: ['Total', '', '', num(rows.reduce((s, r) => s + r.target, 0)), num(rows.reduce((s, r) => s + r.paid, 0)), num(owing), ''],
  }
}

const IN_TYPES = ['CONTRIBUTION'] as const
const OUT_TYPES = ['EXPENSE', 'DISBURSEMENT'] as const

async function transactionsReport({ from, to, direction }: ReportFilters): Promise<Report> {
  const where: Prisma.FinancialTransactionWhereInput = {
    status: { in: ['CONFIRMED', 'RECONCILED'] },
    ...(from || to ? { occurredAt: { ...(from ? { gte: appDayRange(from).start } : {}), ...(to ? { lte: appDayRange(to).end } : {}) } } : {}),
    ...(direction === 'in' ? { type: { in: [...IN_TYPES] } } : direction === 'out' ? { type: { in: [...OUT_TYPES] } } : {}),
  }
  const txs = await prisma.financialTransaction.findMany({
    where,
    orderBy: { occurredAt: 'desc' },
    select: {
      type: true, amount: true, occurredAt: true, description: true, providerReference: true,
      category: { select: { name: true } },
      contribution: { select: { paymentMethod: true, user: { select: { fullName: true } } } },
      expense: { select: { payee: true } },
      disbursement: { select: { beneficiary: true } },
    },
  })
  const isIn = (t: string) => (IN_TYPES as readonly string[]).includes(t)
  const isOut = (t: string) => (OUT_TYPES as readonly string[]).includes(t)
  const moneyIn = txs.filter((t) => isIn(t.type)).reduce((s, t) => s + Number(t.amount), 0)
  const moneyOut = txs.filter((t) => isOut(t.type)).reduce((s, t) => s + Number(t.amount), 0)
  const range = from || to ? `${from ? day(new Date(`${from}T12:00:00Z`)) : 'Start'} – ${to ? day(new Date(`${to}T12:00:00Z`)) : 'today'}` : 'All time'
  return {
    kind: 'transactions',
    title: 'All transactions',
    subtitle: `${range} · ${direction === 'in' ? 'money in' : direction === 'out' ? 'money out' : 'money in and out'} (KES)`,
    kpis: [
      { label: 'Money in', value: kes(moneyIn) },
      { label: 'Money out', value: kes(moneyOut) },
      { label: 'Net', value: `${moneyIn - moneyOut < 0 ? '−' : ''}${kes(Math.abs(moneyIn - moneyOut))}` },
      { label: 'Transactions', value: txs.length.toLocaleString() },
    ],
    columns: [{ label: 'Date' }, { label: 'Name' }, { label: 'Purpose' }, { label: 'Method' }, { label: 'Reference' }, { label: 'Amount', align: 'right' }],
    rows: txs.map((t) => {
      const name = t.contribution?.user.fullName ?? (t.expense?.payee || null) ?? t.disbursement?.beneficiary ?? t.description
      const sign = isIn(t.type) ? '+' : isOut(t.type) ? '−' : ''
      return [day(t.occurredAt), name, t.category?.name ?? t.description, t.contribution ? formatPaymentMethod(t.contribution.paymentMethod) : '—', t.providerReference ?? '—', `${sign}${num(Number(t.amount))}`]
    }),
    totals: ['Net', '', '', '', '', `${moneyIn - moneyOut < 0 ? '−' : '+'}${num(Math.abs(moneyIn - moneyOut))}`],
  }
}

/** Campaigns for the arrears filter. */
export function reportCampaigns() {
  return prisma.contributionCampaign.findMany({ orderBy: { startsAt: 'desc' }, select: { id: true, title: true } })
}
