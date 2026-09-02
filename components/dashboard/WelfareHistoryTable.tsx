'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

export type WelfareHistoryRow = {
  id: string
  status: string
  description: string
  amount: number | null
  reviewNote: string | null
  createdAt: string
}

const STATUS_STYLE: Record<string, { label: string; classes: string; icon: string }> = {
  PENDING: { label: 'Pending review', classes: 'bg-amber-50 text-amber-700 ring-amber-200', icon: 'schedule' },
  APPROVED: { label: 'Approved', classes: 'bg-green-50 text-green-700 ring-green-200', icon: 'check_circle' },
  REJECTED: { label: 'Not approved', classes: 'bg-red-50 text-red-700 ring-red-200', icon: 'cancel' },
  PAID: { label: 'Paid', classes: 'bg-blue-50 text-blue-700 ring-blue-200', icon: 'payments' },
}

export default function WelfareHistoryTable({ requests }: { requests: WelfareHistoryRow[] }) {
  const [mounted, setMounted] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const money = useMemo(
    () => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }),
    [],
  )

  useEffect(() => setMounted(true), [])

  const selected = useMemo(
    () => requests.find((r) => r.id === selectedId) ?? null,
    [requests, selectedId],
  )

  return (
    <div>
      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left bg-surface-container-low border-b border-outline-variant">
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">Date</th>
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">Amount</th>
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">Status</th>
                <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant text-right w-16">View</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-on-surface-variant">No welfare requests yet.</td>
                </tr>
              ) : (
                requests.map((request, i) => {
                  const badge = STATUS_STYLE[request.status] ?? STATUS_STYLE.PENDING
                  return (
                    <tr
                      key={request.id}
                      className={`border-t border-outline-variant/50 hover:bg-primary/[0.03] transition-colors ${i % 2 === 1 ? 'bg-surface-container-low/40' : ''}`}
                    >
                      <td className="py-3.5 px-4 text-on-surface-variant">
                        {new Date(request.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4 text-on-surface">
                        {request.amount ? money.format(Number(request.amount)) : 'Not specified'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${badge.classes}`}>
                          <span className="material-symbols-outlined text-[14px]">{badge.icon}</span>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(request.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant text-primary hover:border-secondary-container hover:bg-secondary-container/10 hover:text-secondary transition-colors"
                          title="View details"
                          aria-label="View request details"
                        >
                          <span className="material-symbols-outlined text-[20px]">visibility</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {mounted &&
        selected &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 bg-primary/55 backdrop-blur-sm"
              aria-label="Close"
              onClick={() => setSelectedId(null)}
            />
            <div className="relative w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_24px_60px_rgba(0,31,80,0.28)] overflow-hidden max-h-[min(90vh,560px)] flex flex-col">
              <div className="relative bg-primary px-5 py-4 shrink-0">
                <div className="absolute bottom-0 inset-x-0 h-1 bg-secondary-container" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-h3 text-[18px] text-on-primary">Welfare request</h3>
                    <p className="text-[12px] text-primary-fixed-dim mt-0.5">
                      {new Date(selected.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="h-9 w-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-on-primary shrink-0"
                  >
                    <span className="material-symbols-outlined text-[22px]">close</span>
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto p-5 space-y-4">
                {(() => {
                  const badge = STATUS_STYLE[selected.status] ?? STATUS_STYLE.PENDING
                  return (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${badge.classes}`}>
                      <span className="material-symbols-outlined text-[14px]">{badge.icon}</span>
                      {badge.label}
                    </span>
                  )
                })()}

                <div className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide font-label-bold text-on-surface-variant">Requested amount</p>
                  <p className="mt-0.5 text-lg font-black text-primary dark:text-primary-fixed-dim">
                    {selected.amount ? money.format(Number(selected.amount)) : 'Not specified'}
                  </p>
                </div>

                <div className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide font-label-bold text-on-surface-variant">Description</p>
                  <p className="mt-0.5 text-sm text-on-surface whitespace-pre-wrap">{selected.description}</p>
                </div>

                {selected.reviewNote && (
                  <div className="rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide font-label-bold text-on-surface-variant">Review note</p>
                    <p className="mt-0.5 text-sm text-on-surface whitespace-pre-wrap">{selected.reviewNote}</p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
