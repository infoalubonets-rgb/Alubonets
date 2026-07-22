'use client'

import { useState, useMemo } from 'react'

type Contribution = {
  id: string
  amount: number
  paidAt: string
  category: string | null
}

type Preset = 'all' | '7d' | '1m' | 'custom'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'all',    label: 'All time' },
  { id: '7d',    label: 'Last 7 days' },
  { id: '1m',    label: 'Last month' },
  { id: 'custom', label: 'Custom' },
]

function toInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

function todayStr() { return toInput(new Date()) }

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toInput(d)
}

function monthAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return toInput(d)
}

export default function ContributionsClient({
  contributions,
  userId,
}: {
  contributions: Contribution[]
  userId: string
}) {
  const [preset, setPreset]       = useState<Preset>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)

  function applyPreset(p: Preset) {
    setPreset(p)
    if (p === '7d') { setStartDate(daysAgo(7)); setEndDate(todayStr()) }
    else if (p === '1m') { setStartDate(monthAgo()); setEndDate(todayStr()) }
    else if (p === 'all') { setStartDate(''); setEndDate('') }
    // 'custom' keeps whatever is in the inputs
  }

  const filtered = useMemo(() => {
    if (!startDate && !endDate) return contributions
    const s = startDate ? new Date(startDate + 'T00:00:00') : null
    const e = endDate   ? new Date(endDate   + 'T23:59:59') : null
    return contributions.filter((c) => {
      const d = new Date(c.paidAt)
      if (s && d < s) return false
      if (e && d > e) return false
      return true
    })
  }, [contributions, startDate, endDate])

  const total = useMemo(() => filtered.reduce((s, c) => s + c.amount, 0), [filtered])

  const isFiltered = preset !== 'all' || !!(startDate || endDate)
  const filterLabel =
    preset === '7d' ? 'Last 7 days' :
    preset === '1m' ? 'Last month' :
    preset === 'custom' && (startDate || endDate)
      ? [startDate, endDate].filter(Boolean).join(' → ')
      : ''

  async function handleDownloadPdf() {
    setPdfLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate)   params.set('endDate',   endDate)
      const qs  = params.toString()
      const url = `/api/pdf/statement/${userId}${qs ? '?' + qs : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const a    = Object.assign(document.createElement('a'), { href, download: 'alubonets-statement.pdf' })
      a.click()
      setTimeout(() => URL.revokeObjectURL(href), 1500)
    } catch (err) {
      console.error('PDF download failed', err)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-10">

      {/* Summary + PDF + filters */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 border-t-4 border-t-secondary-container space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-label-bold uppercase tracking-wide text-secondary">
              Your total{filterLabel ? <> · <span className="font-normal normal-case">{filterLabel}</span></> : ''}
            </p>
            <p className="mt-1 text-3xl font-h3 font-bold text-primary">
              KES {Math.round(total).toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Every role contributes — you are part of the team.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="inline-flex items-center gap-2 rounded-full bg-secondary-container text-on-primary px-4 py-2.5 text-sm font-label-bold shadow-sm hover:opacity-95 disabled:opacity-70 transition-opacity min-w-[148px] justify-center"
          >
            {pdfLoading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-on-primary/30 border-t-on-primary animate-spin flex-shrink-0" />
                Generating…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                Statement PDF
              </>
            )}
          </button>
        </div>

        {/* Preset chips */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                  preset === p.id
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container border-outline-variant text-on-surface-variant hover:border-primary/50 hover:text-primary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-on-surface-variant font-semibold">From</label>
                <input
                  type="date"
                  value={startDate}
                  max={endDate || todayStr()}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-outline-variant rounded-lg px-3 py-1.5 text-[13px] bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-on-surface-variant font-semibold">To</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={todayStr()}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border border-outline-variant rounded-lg px-3 py-1.5 text-[13px] bg-surface text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate('') }}
                  className="text-[11px] text-on-surface-variant hover:text-primary transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
          <h2 className="font-label-bold text-sm text-on-surface">Contribution history</h2>
          {isFiltered && (
            <span className="text-[11px] text-on-surface-variant">
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-sm text-on-surface-variant text-center">
            {isFiltered ? 'No contributions in this period.' : 'No contributions recorded yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-on-surface-variant border-b border-outline-variant/60">
                  <th className="py-3 px-4 font-label-bold">Date</th>
                  <th className="py-3 px-4 font-label-bold">Amount</th>
                  <th className="py-3 px-4 font-label-bold">Category</th>
                  <th className="py-3 px-4 font-label-bold">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    className={`border-t border-outline-variant/40 ${i % 2 === 1 ? 'bg-surface-container-low/60' : ''}`}
                  >
                    <td className="py-3 px-4">
                      {new Date(c.paidAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-4 font-label-bold text-secondary">
                      KES {c.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">{c.category || '—'}</td>
                    <td className="py-3 px-4">
                      <a
                        href={`/api/pdf/receipt/${c.id}`}
                        className="text-secondary-container font-label-bold underline hover:opacity-80 transition-opacity"
                      >
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
