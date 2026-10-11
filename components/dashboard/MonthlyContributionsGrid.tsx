'use client'

import { useEffect, useMemo, useState } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'

type GridData = {
  year: number
  years: number[]
  months: string[]
  rows: { id: string; name: string; membershipNumber: string | null; plan: string | null; cells: number[]; total: number; activeMonths: number }[]
  monthTotals: number[]
}

const amount = (value: number) => (value ? value.toLocaleString('en-KE', { maximumFractionDigits: 0 }) : '')

/** "Monthly grid" button: a near-full-screen members × months table of contributions for a year. */
export default function MonthlyContributionsGrid() {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<GridData | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [onlyPaid, setOnlyPaid] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError('')
    setData(null)
    fetch(`/api/contributions/grid?year=${year}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || 'Could not load the grid.')
        if (!cancelled) setData(body as GridData)
      })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the grid.') })
    return () => { cancelled = true }
  }, [open, year])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.rows ?? []).filter((r) => (!onlyPaid || r.total > 0) && (!q || r.name.toLowerCase().includes(q) || r.membershipNumber?.toLowerCase().includes(q)))
  }, [data, query, onlyPaid])
  const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() : -1

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-semibold text-on-primary hover:opacity-90">
        <span className="material-symbols-outlined text-[18px]">calendar_view_month</span>
        Monthly grid
      </button>
      <FullScreenModal open={open} title={`Contributions by month · ${year}`} onClose={() => setOpen(false)} size="xl">
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year" className="h-10 rounded-xl border bg-surface px-3 text-sm">
              {(data?.years ?? [year]).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <label className="relative min-w-[200px] flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant">search</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search member…" className="h-10 w-full rounded-xl border bg-surface py-2 pl-9 pr-3 text-sm" />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-on-surface-variant">
              <input type="checkbox" checked={onlyPaid} onChange={(e) => setOnlyPaid(e.target.checked)} className="h-4 w-4 accent-primary" />
              Only members who paid
            </label>
            <span className="text-xs text-on-surface-variant">Amounts in KES · confirmed payments by the month they were paid</span>
          </div>

          {error ? (
            <p className="rounded-xl bg-error-container/40 px-3 py-3 text-sm text-error">{error}</p>
          ) : !data ? (
            <div className="flex items-center gap-2 py-10 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              Loading…
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-outline-variant">
              <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-20 bg-surface-container-low text-[11px] uppercase tracking-wide text-on-surface-variant">
                  <tr>
                    <th className="sticky left-0 z-30 border-b border-r border-outline-variant bg-surface-container-low px-3 py-2 text-left">Member</th>
                    {data.months.map((m, i) => (
                      <th key={m} className={`border-b border-outline-variant px-2 py-2 text-right ${i === currentMonth ? 'bg-primary/10 text-primary' : ''}`}>{m}</th>
                    ))}
                    <th className="border-b border-l border-outline-variant px-3 py-2 text-right">Total</th>
                    <th className="border-b border-outline-variant px-3 py-2 text-right">Months</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={15} className="py-10 text-center text-on-surface-variant">No members match.</td></tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-primary/[0.03]">
                      <td className="sticky left-0 z-10 max-w-[220px] border-b border-r border-outline-variant/60 bg-surface px-3 py-1.5">
                        <p className="truncate font-medium text-on-surface">{r.name}</p>
                        <p className="truncate text-[10px] text-on-surface-variant">{[r.membershipNumber, r.plan && (r.plan === 'MONTHLY' ? 'Monthly' : 'Annual')].filter(Boolean).join(' · ') || '—'}</p>
                      </td>
                      {r.cells.map((value, i) => (
                        <td key={i} className={`border-b border-outline-variant/40 px-2 py-1.5 text-right tabular-nums ${value ? 'bg-green-50 font-semibold text-green-800 dark:bg-green-500/10 dark:text-green-200' : i <= currentMonth || currentMonth === -1 ? 'text-outline' : ''}`}>
                          {amount(value) || (i <= currentMonth || currentMonth === -1 ? '—' : '')}
                        </td>
                      ))}
                      <td className="border-b border-l border-outline-variant/60 px-3 py-1.5 text-right font-bold tabular-nums">{amount(r.total) || '0'}</td>
                      <td className="border-b border-outline-variant/40 px-3 py-1.5 text-right tabular-nums">{r.activeMonths}/12</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-20 bg-surface-container-low font-bold">
                  <tr>
                    <td className="sticky left-0 z-30 border-t border-r border-outline-variant bg-surface-container-low px-3 py-2">Month total</td>
                    {data.monthTotals.map((value, i) => <td key={i} className="border-t border-outline-variant px-2 py-2 text-right tabular-nums">{amount(value) || '0'}</td>)}
                    <td className="border-t border-l border-outline-variant px-3 py-2 text-right tabular-nums">{amount(data.monthTotals.reduce((s, v) => s + v, 0)) || '0'}</td>
                    <td className="border-t border-outline-variant px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </FullScreenModal>
    </>
  )
}
