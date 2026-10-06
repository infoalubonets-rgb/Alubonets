'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

export type MemberContributionRow = {
  id: string
  fullName: string
  membershipNumber: string | null
  status: string
  standing: string
  payments: number
  totalPaid: number
  pending: number
  lastPaidAt: string | null
}

const kes = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 })

/** Every member's contribution totals; a row opens that member's full contributions page. */
export default function MemberContributionsTable({ rows }: { rows: MemberContributionRow[] }) {
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<'all' | 'paid' | 'none'>('all')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (show === 'paid' && row.payments === 0) return false
      if (show === 'none' && row.payments > 0) return false
      return !q || row.fullName.toLowerCase().includes(q) || row.membershipNumber?.toLowerCase().includes(q)
    })
  }, [rows, query, show])

  const totals = {
    collected: rows.reduce((sum, row) => sum + row.totalPaid, 0),
    contributing: rows.filter((row) => row.payments > 0).length,
    pending: rows.reduce((sum, row) => sum + row.pending, 0),
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 pb-10 md:px-0">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total collected', value: kes.format(totals.collected) },
          { label: 'Members', value: rows.length },
          { label: 'Contributing', value: totals.contributing },
          { label: 'Pending checks', value: totals.pending },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-outline-variant bg-surface px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{stat.label}</p>
            <p className="mt-0.5 text-xl font-semibold text-on-surface">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[200px] flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant">search</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search member or membership number…" className="h-10 w-full rounded-xl border bg-surface py-2 pl-9 pr-3 text-sm" />
        </label>
        <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} aria-label="Filter members by payments" className="h-10 rounded-xl border bg-surface px-3 text-sm">
          <option value="all">All members</option>
          <option value="paid">Have paid</option>
          <option value="none">Not yet paid</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_4px_12px_rgba(20,32,51,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low text-left">
                {['Member', 'Payments', 'Total paid', 'Last payment', 'Standing'].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">{heading}</th>
                ))}
                <th className="w-16 px-4 py-3 text-right font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">View</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-on-surface-variant">No members match.</td></tr>
              ) : (
                visible.map((row, i) => (
                  <tr key={row.id} className={`border-t border-outline-variant/50 transition-colors hover:bg-primary/[0.03] ${i % 2 === 1 ? 'bg-surface-container-low/40' : ''}`}>
                    <td className="px-4 py-3">
                      <Link href={`/contributions/member/${row.id}`} className="font-medium text-on-surface hover:text-primary hover:underline">{row.fullName}</Link>
                      <p className="text-xs text-on-surface-variant">
                        {row.membershipNumber || '—'}
                        {row.status !== 'ACTIVE' && <span className="ml-1.5 rounded-full bg-surface-container px-1.5 text-[10px] font-bold">{row.status.toLowerCase()}</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {row.payments}
                      {row.pending > 0 && <span className="ml-1.5 rounded-full bg-secondary-fixed px-1.5 text-[10px] font-bold text-secondary">{row.pending} pending</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-on-surface">{kes.format(row.totalPaid)}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{row.lastPaidAt ? new Date(row.lastPaidAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${row.standing === 'PAID_UP' ? 'bg-green-100 text-green-800' : 'bg-error-container text-error'}`}>
                        {row.standing === 'PAID_UP' ? 'Paid-up' : 'Lapsed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/contributions/member/${row.id}`} title="Open contributions" aria-label={`Open contributions for ${row.fullName}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition hover:bg-primary/10">
                        <span className="material-symbols-outlined text-[19px]">visibility</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-on-surface-variant">Totals count confirmed and reconciled payments. Pending payments are still waiting for a second check.</p>
    </div>
  )
}
