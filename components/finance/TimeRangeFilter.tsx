'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TIME_RANGES } from '@/lib/time-range'

/**
 * Time filter dropdown for finance pages: All time, Last 24 hours, This week, Last 7 / 30 days,
 * or Custom (start and end date appear inline). Writes `range`, `from` and `to` to the URL; the
 * server turns them into exact Nairobi-time bounds with `resolveTimeRange`.
 */
export default function TimeRangeFilter({ range, from, to, clear = ['page'] }: { range: string; from: string; to: string; clear?: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState(range || 'all')
  const [start, setStart] = useState(from)
  const [end, setEnd] = useState(to)

  const go = (values: Record<string, string>) => {
    const params = new URLSearchParams(search.toString())
    for (const key of [...clear, 'month']) params.delete(key)
    for (const [key, value] of Object.entries(values)) { if (value) params.set(key, value); else params.delete(key) }
    const query = params.toString()
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
  }

  const choose = (value: string) => {
    setMode(value)
    if (value === 'custom') {
      if (start || end) go({ range: 'custom', from: start, to: end })
      return
    }
    go({ range: value === 'all' ? '' : value, from: '', to: '' })
  }

  const field = 'h-10 rounded-xl border border-outline-variant bg-surface px-3 text-sm text-on-surface'
  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <select aria-label="Time period" value={mode} onChange={(e) => choose(e.target.value)} className={field}>
        {TIME_RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
      </select>
      {mode === 'custom' && (
        <>
          <label className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant">
            Start
            <input type="date" value={start} max={end || undefined} onChange={(e) => { setStart(e.target.value); go({ range: 'custom', from: e.target.value, to: end }) }} className={field} />
          </label>
          <label className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant">
            End
            <input type="date" value={end} min={start || undefined} onChange={(e) => { setEnd(e.target.value); go({ range: 'custom', from: start, to: e.target.value }) }} className={field} />
          </label>
        </>
      )}
      {pending && <span className="material-symbols-outlined animate-spin text-[18px] text-primary" aria-hidden="true">progress_activity</span>}
    </div>
  )
}
