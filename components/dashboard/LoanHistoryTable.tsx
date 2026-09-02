'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

export type LoanHistoryRow = {
  id: string
  amountKes: number
  purpose: string
  status: string
  dueAt: string | null
  installmentNotes: string | null
  treasurerNote: string | null
  decisionNote: string | null
  createdAt: string
  outstandingKes: number
  guarantors: { name: string; status: string }[]
}

const STATUS_STYLE: Record<string, { label: string; classes: string; icon: string }> = {
  SUBMITTED: { label: 'Submitted', classes: 'bg-amber-50 text-amber-700 ring-amber-200', icon: 'schedule' },
  UNDER_REVIEW: { label: 'Under review', classes: 'bg-blue-50 text-blue-700 ring-blue-200', icon: 'manage_search' },
  APPROVED: { label: 'Approved', classes: 'bg-green-50 text-green-700 ring-green-200', icon: 'check_circle' },
  REJECTED: { label: 'Not approved', classes: 'bg-red-50 text-red-700 ring-red-200', icon: 'cancel' },
  DISBURSED: { label: 'Disbursed', classes: 'bg-violet-50 text-violet-700 ring-violet-200', icon: 'payments' },
  CLOSED: { label: 'Closed', classes: 'bg-slate-100 text-slate-700 ring-slate-200', icon: 'task_alt' },
}

export default function LoanHistoryTable({ applications }: { applications: LoanHistoryRow[] }) {
  const [mounted, setMounted] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(() => applications.find((item) => item.id === selectedId) ?? null, [applications, selectedId])
  const money = useMemo(() => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }), [])
  useEffect(() => setMounted(true), [])

  return <div>
    <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
      <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
        <thead><tr className="border-b border-outline-variant bg-surface-container-low text-left">
          <th className="px-4 py-3 text-[11px] font-label-bold uppercase tracking-wide text-on-surface-variant">Date</th>
          <th className="px-4 py-3 text-[11px] font-label-bold uppercase tracking-wide text-on-surface-variant">Amount</th>
          <th className="px-4 py-3 text-[11px] font-label-bold uppercase tracking-wide text-on-surface-variant">Status</th>
          <th className="w-16 px-4 py-3 text-right text-[11px] font-label-bold uppercase tracking-wide text-on-surface-variant">View</th>
        </tr></thead>
        <tbody>{applications.length === 0 ? <tr><td colSpan={4} className="py-10 text-center text-on-surface-variant">No loan applications yet.</td></tr> : applications.map((loan, index) => {
          const badge = STATUS_STYLE[loan.status] ?? STATUS_STYLE.SUBMITTED
          return <tr key={loan.id} className={`border-t border-outline-variant/50 transition-colors hover:bg-primary/[0.03] ${index % 2 ? 'bg-surface-container-low/40' : ''}`}>
            <td className="px-4 py-3.5 text-on-surface-variant">{new Date(loan.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            <td className="px-4 py-3.5 font-semibold text-on-surface">{money.format(loan.amountKes)}</td>
            <td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${badge.classes}`}><span className="material-symbols-outlined text-[14px]">{badge.icon}</span>{badge.label}</span></td>
            <td className="px-4 py-3.5 text-right"><button type="button" onClick={() => setSelectedId(loan.id)} aria-label="View loan details" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant text-primary transition-colors hover:border-secondary-container hover:bg-secondary-container/10 hover:text-secondary"><span className="material-symbols-outlined text-[20px]">visibility</span></button></td>
          </tr>
        })}</tbody>
      </table></div>
    </div>
    {mounted && selected && createPortal(<div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-primary/55 backdrop-blur-sm" aria-label="Close" onClick={() => setSelectedId(null)} />
      <div className="relative flex max-h-[min(90vh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_24px_60px_rgba(0,31,80,0.28)]">
        <div className="relative shrink-0 bg-primary px-5 py-4"><div className="absolute inset-x-0 bottom-0 h-1 bg-secondary-container" /><div className="flex items-start justify-between gap-3"><div><h3 className="font-h3 text-[18px] text-on-primary">Loan application</h3><p className="mt-0.5 text-[12px] text-primary-fixed-dim">{new Date(selected.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div><button type="button" onClick={() => setSelectedId(null)} className="grid h-9 w-9 place-items-center rounded-lg text-on-primary hover:bg-white/10"><span className="material-symbols-outlined">close</span></button></div></div>
        <div className="space-y-4 overflow-y-auto p-5">
          {(() => { const badge = STATUS_STYLE[selected.status] ?? STATUS_STYLE.SUBMITTED; return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${badge.classes}`}><span className="material-symbols-outlined text-[14px]">{badge.icon}</span>{badge.label}</span> })()}
          <Detail label="Requested amount" value={money.format(selected.amountKes)} prominent />
          <Detail label="Purpose" value={selected.purpose} />
          {selected.dueAt && <Detail label="Preferred repayment date" value={new Date(selected.dueAt).toLocaleDateString('en-KE')} />}
          {selected.installmentNotes && <Detail label="Repayment plan" value={selected.installmentNotes} />}
          <Detail label="Guarantors" value={selected.guarantors.map((g) => `${g.name} (${g.status.toLowerCase()})`).join(', ') || 'None'} />
          {selected.treasurerNote && <Detail label="Treasurer note" value={selected.treasurerNote} />}
          {selected.decisionNote && <Detail label="Decision note" value={selected.decisionNote} />}
          {['DISBURSED', 'CLOSED'].includes(selected.status) && <Detail label="Outstanding balance" value={money.format(selected.outstandingKes)} prominent />}
        </div>
      </div>
    </div>, document.body)}
  </div>
}

function Detail({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return <div className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5"><p className="text-[10px] font-label-bold uppercase tracking-wide text-on-surface-variant">{label}</p><p className={`mt-0.5 whitespace-pre-wrap ${prominent ? 'text-lg font-black text-primary dark:text-primary-fixed-dim' : 'text-sm text-on-surface'}`}>{value}</p></div>
}
