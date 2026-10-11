'use client'

import { useState, useTransition } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export default function LedgerFilters({ range = '', from, to, today, categories, category }: {
  range?: string; from: string; to: string; today: string; categories: { id: string; name: string }[]; category: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState(range || search.get('range') || (from || to ? 'custom' : 'all'))
  const [datesOpen, setDatesOpen] = useState(false)
  const [start, setStart] = useState(from)
  const [end, setEnd] = useState(to)
  const update = (values: Record<string, string>) => {
    const params = new URLSearchParams(search.toString())
    params.delete('page'); params.delete('month')
    for (const [key, value] of Object.entries(values)) { if (value) params.set(key, value); else params.delete(key) }
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }))
  }
  const selectRange = (value: string) => {
    setMode(value)
    setDatesOpen(value === 'custom')
    if (value === 'custom') return
    if (value === 'all') { setStart(''); setEnd(''); update({ range: '', from: '', to: '' }); return }
    // The last 24 hours is measured to the hour on the server, so no dates are sent.
    if (value === '24h') { setStart(''); setEnd(''); update({ range: '24h', from: '', to: '' }); return }
    const date = new Date(`${today}T12:00:00Z`)
    const days = value === 'week' ? (date.getUTCDay() + 6) % 7 : value === '7' ? 6 : 29
    date.setUTCDate(date.getUTCDate() - days)
    const fromDate = date.toISOString().slice(0, 10)
    setStart(fromDate); setEnd(today)
    update({ range: value, from: fromDate, to: today })
  }
  const field = 'block h-10 !min-w-0 rounded-lg border px-2 text-sm font-normal text-on-surface'
  return <div className="flex flex-wrap items-end gap-2" aria-busy={pending}>
    <div className="relative"><label>
      <select aria-label="Date range" value={mode} onChange={e => selectRange(e.target.value)} className={`${field} !w-[145px]`}>
        <option value="all">All time</option><option value="24h">Last 24 hours</option><option value="week">This week</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="custom">Custom</option>
      </select>
    </label>
    {mode === 'custom' && !datesOpen && <button type="button" onClick={() => setDatesOpen(true)} className="absolute bottom-0 right-7 top-0 w-6 rounded text-primary hover:bg-primary/10" aria-label="Edit custom dates"><span className="material-symbols-outlined text-[16px]">edit_calendar</span></button>} 
    <FullScreenModal open={mode === 'custom' && datesOpen} title="Custom date range" size="compact" onClose={() => setDatesOpen(false)}><div className="flex flex-wrap gap-3">
      <label className="text-xs font-semibold text-on-surface-variant">Start date<input type="date" value={start} onChange={e => { setStart(e.target.value); update({ range: 'custom', from: e.target.value, to: end }) }} className={`${field} !w-[130px]`} /></label>
      <label className="text-xs font-semibold text-on-surface-variant">End date<input type="date" value={end} onChange={e => { setEnd(e.target.value); update({ range: 'custom', from: start, to: e.target.value }) }} className={`${field} !w-[130px]`} /></label>
    </div></FullScreenModal></div>
    <label>
      <select aria-label="Purpose" value={category} onChange={e => update({ category: e.target.value })} className={`${field} !w-[145px]`}><option value="">All purposes</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    </label>
  </div>
}





