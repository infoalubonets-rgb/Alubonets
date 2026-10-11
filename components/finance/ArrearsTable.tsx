'use client'

import { useState } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'

export type ArrearsRow = {
  id: string
  member: string
  membershipNumber: string | null
  email: string
  phone: string | null
  standing: string
  plan: string | null
  campaign: string
  campaignPurpose: string
  campaignDescription: string | null
  startsAt: string
  dueAt: string | null
  overdueDays: number | null
  status: string
  target: number
  paid: number
  balance: number
  payments: { id: string; date: string; amount: number; method: string; reference: string | null; status: string }[]
}

const kes = (value: number) => `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`
const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')

/** Arrears with an eye button per row that opens everything about that member's obligation. */
export default function ArrearsTable({ rows }: { rows: ArrearsRow[] }) {
  const [viewing, setViewing] = useState<ArrearsRow | null>(null)

  return (
    <>
      <div className="max-h-80 overflow-auto rounded-xl border border-outline-variant/60">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="sticky top-0 bg-surface-container-low text-left text-[11px] uppercase tracking-wide text-on-surface-variant">
            <tr>
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2 text-right">Target</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Owing</th>
              <th className="w-12 px-3 py-2 text-right">View</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-outline-variant/50">
                <td className="px-3 py-2 font-medium">{row.member}</td>
                <td className="px-3 py-2 text-on-surface-variant">
                  {row.campaign}
                  {row.overdueDays != null && <span className="ml-1.5 rounded-full bg-error px-1.5 py-0.5 text-[10px] font-bold text-on-error">Overdue</span>}
                </td>
                <td className="px-3 py-2 text-right">{kes(row.target)}</td>
                <td className="px-3 py-2 text-right">{kes(row.paid)}</td>
                <td className="px-3 py-2 text-right font-semibold text-error">{kes(row.balance)}</td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => setViewing(row)}
                    title="See details"
                    aria-label={`See details for ${row.member}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant text-primary hover:bg-primary/5"
                  >
                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FullScreenModal open={Boolean(viewing)} title={viewing ? `${viewing.member} · ${viewing.campaign}` : 'Arrears'} onClose={() => setViewing(null)} size="wide">
        {viewing && <ArrearsDetail row={viewing} />}
      </FullScreenModal>
    </>
  )
}

function ArrearsDetail({ row }: { row: ArrearsRow }) {
  const progress = row.target > 0 ? Math.min(100, Math.round((row.paid / row.target) * 100)) : 0
  const facts = [
    { label: 'Member', value: `${row.member}${row.membershipNumber ? ` (${row.membershipNumber})` : ''}` },
    { label: 'Contact', value: [row.email, row.phone].filter(Boolean).join(' · ') },
    { label: 'Standing', value: row.standing === 'PAID_UP' ? 'Paid-up' : 'Lapsed' },
    { label: 'Contribution plan', value: row.plan ? label(row.plan) : 'Not set' },
    { label: 'Campaign', value: row.campaign },
    { label: 'Purpose', value: row.campaignPurpose },
    { label: 'Started', value: row.startsAt },
    { label: 'Due', value: row.dueAt ?? 'No due date' },
    { label: 'Obligation status', value: label(row.status) },
  ]
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Target', value: kes(row.target), tone: 'text-on-surface' },
          { label: 'Paid', value: kes(row.paid), tone: 'text-green-700 dark:text-green-300' },
          { label: 'Owing', value: kes(row.balance), tone: 'text-error' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-outline-variant px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{stat.label}</p>
            <p className={`text-base font-semibold ${stat.tone}`}>{stat.value}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs text-on-surface-variant">
          <span>{progress}% paid</span>
          {row.overdueDays != null && <span className="font-bold text-error">Overdue by {row.overdueDays} day{row.overdueDays === 1 ? '' : 's'}</span>}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
          <div className="h-full rounded-full bg-green-600" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0 border-b border-outline-variant/40 pb-1.5">
            <dt className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{fact.label}</dt>
            <dd className="break-words text-sm text-on-surface">{fact.value || '—'}</dd>
          </div>
        ))}
      </dl>
      {row.campaignDescription && <p className="rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">{row.campaignDescription}</p>}

      <section>
        <h3 className="mb-2 text-sm font-bold text-primary">Payments toward this campaign</h3>
        {row.payments.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-outline-variant/50 rounded-xl border border-outline-variant">
            {row.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>{p.date} · {p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold">{label(p.status)}</span>
                  <b>{kes(p.amount)}</b>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
