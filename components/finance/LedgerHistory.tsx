'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LedgerStatusSelect from './LedgerStatusSelect'
import { formatPaymentMethod } from '@/lib/chart-labels'
import { readableError } from '@/lib/form-errors'
import type { LedgerHistoryRow } from '@/lib/ledger-history'

type Direction = 'all' | 'in' | 'out' | 'corrections'
type Flow = 'in' | 'out' | 'other'

const DIRECTIONS: { key: Direction; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'list' },
  { key: 'in', label: 'Money in', icon: 'south_west' },
  { key: 'out', label: 'Money out', icon: 'north_east' },
  { key: 'corrections', label: 'Corrections', icon: 'sync_alt' },
]
const STATUSES = ['PENDING', 'CONFIRMED', 'RECONCILED', 'REVERSED', 'REJECTED'] as const

const flowOf = (type: string): Flow =>
  type === 'CONTRIBUTION' ? 'in' : type === 'EXPENSE' || type === 'DISBURSEMENT' ? 'out' : 'other'
const FLOW_LABEL: Record<Flow, string> = { in: 'Money in', out: 'Money out', other: 'Correction' }
const FLOW_STYLE: Record<Flow, { icon: string; badge: string; amount: string }> = {
  in: { icon: 'south_west', badge: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300', amount: 'text-green-700 dark:text-green-300' },
  out: { icon: 'north_east', badge: 'bg-error-container text-error', amount: 'text-error' },
  other: { icon: 'sync_alt', badge: 'bg-surface-container-high text-on-surface-variant', amount: 'text-on-surface' },
}
const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-secondary-fixed text-secondary',
  CONFIRMED: 'bg-primary/10 text-primary',
  RECONCILED: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200',
  REVERSED: 'bg-surface-container text-on-surface-variant line-through',
  REJECTED: 'bg-error-container text-error',
}

const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')
const kes = (value: number) => `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`
const TIMEZONE = 'Africa/Nairobi'
const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date(iso))
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: TIMEZONE })

type Result = { rows: LedgerHistoryRow[]; count: number; pageSize: number; page: number }

/** Ledger transaction history; filters fetch only the transactions, not the whole ledger page. */
export default function LedgerHistory({
  range = '',
  from,
  to,
  category,
  canRecord,
  initialDirection = 'all',
  initialStatus = '',
  initialQuery = '',
}: {
  range?: string
  from: string
  to: string
  category: string
  canRecord: boolean
  initialDirection?: Direction
  initialStatus?: string
  initialQuery?: string
}) {
  const router = useRouter()
  const [direction, setDirection] = useState<Direction>(initialDirection)
  const [status, setStatus] = useState(initialStatus)
  const [query, setQuery] = useState(initialQuery)
  const [search, setSearch] = useState(initialQuery)
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (range && range !== 'all') params.set('range', range)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (category) params.set('category', category)
    if (direction !== 'all') params.set('dir', direction)
    if (status) params.set('status', status)
    if (search) params.set('q', search)
    if (page > 1) params.set('page', String(page))
    setLoading(true)
    setError('')
    fetch(`/api/finance/ledger-history?${params}`, { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || 'Could not load transactions.')
        setResult(body as Result)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Could not load transactions.')
        setLoading(false)
      })
    return () => controller.abort()
  }, [range, from, to, category, direction, status, search, page, reload])

  const choose = (next: Partial<{ direction: Direction; status: string; search: string }>) => {
    if (next.direction !== undefined) setDirection(next.direction)
    if (next.status !== undefined) setStatus(next.status)
    if (next.search !== undefined) setSearch(next.search)
    setPage(1)
  }

  const rows = result?.rows ?? []
  const count = result?.count ?? 0
  const pages = result ? Math.max(1, Math.ceil(count / result.pageSize)) : 1
  const filtered = Boolean(from || to || category || direction !== 'all' || status || search)

  const days: { key: string; label: string; net: number; rows: LedgerHistoryRow[] }[] = []
  for (const tx of rows) {
    const key = dayKey(tx.occurredAt)
    let day = days[days.length - 1]
    if (!day || day.key !== key) {
      day = { key, label: dayLabel(tx.occurredAt), net: 0, rows: [] }
      days.push(day)
    }
    day.rows.push(tx)
    if (tx.status === 'CONFIRMED' || tx.status === 'RECONCILED') {
      const flow = flowOf(tx.type)
      day.net += flow === 'in' ? tx.amount : flow === 'out' ? -tx.amount : 0
    }
  }

  return (
    <section className="p-1 sm:p-2">
      <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Transaction direction">
        {DIRECTIONS.map((d) => {
          const active = direction === d.key
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => choose({ direction: d.key })}
              aria-pressed={active}
              className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                active ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant hover:bg-primary/5'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{d.icon}</span>
              {d.label}
            </button>
          )
        })}
      </nav>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          choose({ search: query.trim() })
        }}
        className="mb-4 flex flex-wrap items-center gap-2 text-sm"
      >
        <select value={status} onChange={(e) => choose({ status: e.target.value })} className="rounded-lg border px-3 py-1.5" aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} placeholder="Search name, description or reference" className="min-w-[14rem] flex-1 rounded-lg border px-3 py-1.5" />
        <button className="rounded-full bg-primary px-4 py-1.5 text-on-primary">Search</button>
        {(direction !== 'all' || status || search) && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              choose({ direction: 'all', status: '', search: '' })
            }}
            className="text-primary underline"
          >
            Clear
          </button>
        )}
      </form>

      <div className="relative min-h-[8rem]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-start justify-center bg-surface/60 pt-10 backdrop-blur-[1px]">
            <span className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm text-on-surface-variant shadow">
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              Loading transactions…
            </span>
          </div>
        )}

        {error ? (
          <div className="space-y-2 rounded-xl bg-error-container/40 px-3 py-3 text-sm text-error">
            <p>{error}</p>
            <button type="button" onClick={() => setReload((n) => n + 1)} className="font-semibold underline">Try again</button>
          </div>
        ) : result && rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant py-10 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[36px] text-primary/30">receipt_long</span>
            <p className="text-sm">
              {direction === 'out' && !status && !search
                ? 'No money has been paid out yet. Expenses, loan and welfare payouts appear here once recorded.'
                : filtered
                  ? 'No transactions match these filters.'
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
                    const flow = flowOf(tx.type)
                    const details = [
                      tx.category ?? FLOW_LABEL[flow],
                      tx.party && tx.description !== tx.party ? tx.description : null,
                      tx.paymentMethod ? formatPaymentMethod(tx.paymentMethod) : null,
                      tx.providerReference ? `Ref ${tx.providerReference}` : null,
                    ].filter(Boolean)
                    const inactive = tx.status === 'REVERSED' || tx.status === 'REJECTED'
                    return (
                      <li key={tx.id} className={`relative flex flex-wrap items-center gap-3 px-3 py-3 ${inactive ? 'opacity-60' : ''}`}>
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${FLOW_STYLE[flow].badge}`}>
                          <span className="material-symbols-outlined text-[20px]">{FLOW_STYLE[flow].icon}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-on-surface">{tx.party ?? tx.description}</p>
                          <p className="truncate text-xs text-on-surface-variant">{details.join(' · ')}</p>
                          {tx.reverses && <p className="truncate text-xs text-on-surface-variant">Reverses: {tx.reverses}</p>}
                          {tx.correctionReason && <p className="truncate text-xs text-on-surface-variant">Reason: {tx.correctionReason}</p>}
                          <p className="text-[11px] text-outline">Recorded by {tx.recordedBy}</p>
                        </div>
                        <div className="ml-auto flex flex-col items-end gap-1 text-right">
                          <span className={`whitespace-nowrap text-[15px] font-bold ${FLOW_STYLE[flow].amount} ${tx.status === 'REVERSED' ? 'line-through' : ''}`}>
                            {flow === 'in' ? '+' : flow === 'out' ? '−' : ''}{kes(tx.amount)}
                          </span>
                          <span className="flex flex-wrap justify-end gap-1">
                            {tx.addedAfterClose && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Added after close</span>}
                            {tx.editedAfterClose && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">Edited after close</span>}
                          </span>
                        </div>
                        <LedgerStatusSelect id={tx.id} status={tx.status} type={tx.type} canApprove={Boolean(tx.canApprove)} canReverse={canRecord} reversalPending={Boolean(tx.reversalPending)} onDone={() => { setReload(n => n + 1); router.refresh() }} />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {result && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
          <p>{count.toLocaleString()} transaction{count === 1 ? '' : 's'}</p>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-outline-variant px-3 py-1 font-semibold text-primary disabled:opacity-40">
                Previous
              </button>
              <span>Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-outline-variant px-3 py-1 font-semibold text-primary disabled:opacity-40">
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}


