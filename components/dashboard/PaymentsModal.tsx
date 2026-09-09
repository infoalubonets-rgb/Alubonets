'use client'

import { useState, useMemo } from 'react'
import type { Prisma } from '@prisma/client'

const MPESA_ERRORS: Record<number, string> = {
  1:    'Insufficient funds',
  1001: 'Transaction already in progress',
  1019: 'Transaction expired',
  1032: 'Cancelled by user',
  1037: 'User unreachable',
  2001: 'Wrong PIN entered',
}

function errorLabel(code: number | undefined, desc: string | undefined) {
  if (code !== undefined && MPESA_ERRORS[code]) return MPESA_ERRORS[code]
  return desc || 'Payment failed'
}

type SuccessPayment = {
  id: string
  amount: number
  paidAt: string
  mpesaRef: string | null
  user: { fullName: string; email: string }
}

type FailedPayment = {
  id: string
  createdAt: string
  meta: Prisma.JsonObject
  user: { fullName: string; email: string } | null
}

type Tab = 'success' | 'failed'
type DateFilter = 'all' | '7d' | '1m'

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d
}

export default function PaymentsModal({
  successPayments,
  failedPayments,
}: {
  successPayments: SuccessPayment[]
  failedPayments: FailedPayment[]
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('success')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')

  const totalAmount = successPayments.reduce((s, p) => s + p.amount, 0)
  const successRate =
    successPayments.length + failedPayments.length > 0
      ? Math.round((successPayments.length / (successPayments.length + failedPayments.length)) * 100)
      : 100

  const filtered = useMemo(() => {
    if (dateFilter === 'all') return successPayments
    const cutoff = dateFilter === '7d' ? daysAgo(7) : daysAgo(30)
    return successPayments.filter((p) => new Date(p.paidAt) >= cutoff)
  }, [successPayments, dateFilter])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/20 text-primary px-4 py-2 text-[13px] font-semibold transition-colors"
      >
        <span className="material-symbols-outlined icon-fill" style={{ fontSize: 16 }}>receipt_long</span>
        M-Pesa Payments
        {failedPayments.length > 0 && (
          <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
            {failedPayments.length} failed
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,31,80,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant dark:border-[#1a2d4f] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>receipt_long</span>
                </div>
                <h2 className="font-semibold text-[15px] text-on-surface dark:text-blue-50">M-Pesa Payments</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 px-5 py-3 border-b border-outline-variant dark:border-[#1a2d4f] shrink-0">
              {[
                { label: 'Total collected', value: `KES ${Math.round(totalAmount).toLocaleString()}`, color: 'text-primary' },
                { label: 'Successful', value: successPayments.length, color: 'text-green-600' },
                { label: 'Failed', value: failedPayments.length, color: failedPayments.length > 0 ? 'text-red-500' : 'text-on-surface-variant' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className={`text-[20px] font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-5 py-3 border-b border-outline-variant dark:border-[#1a2d4f] shrink-0">
              {([['success', 'Successful', successPayments.length], ['failed', 'Failed', failedPayments.length]] as const).map(([id, label, count]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                    tab === id
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface border-outline-variant text-on-surface-variant hover:border-primary/40'
                  }`}
                >
                  {label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold ${
                    tab === id ? 'bg-white/20' : id === 'failed' && count > 0 ? 'bg-red-100 text-red-600' : 'bg-surface-container text-on-surface-variant'
                  }`}>
                    {count}
                  </span>
                </button>
              ))}
              {tab === 'success' && (
                <div className="ml-auto flex gap-1">
                  {(['all', '7d', '1m'] as DateFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setDateFilter(f)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                        dateFilter === f
                          ? 'bg-surface-container border-outline text-on-surface'
                          : 'border-outline-variant text-on-surface-variant hover:border-outline'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === '7d' ? '7 days' : 'Month'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1">
              {tab === 'success' ? (
                filtered.length === 0 ? (
                  <p className="py-16 text-center text-sm text-on-surface-variant">No payments in this period.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface dark:bg-[#0d1729] border-b border-outline-variant/60 z-10">
                      <tr className="text-left text-on-surface-variant">
                        <th className="py-2.5 px-5 font-semibold text-[12px]">Date</th>
                        <th className="py-2.5 px-4 font-semibold text-[12px]">Member</th>
                        <th className="py-2.5 px-4 font-semibold text-[12px]">Amount</th>
                        <th className="py-2.5 px-4 font-semibold text-[12px]">M-Pesa Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p, i) => (
                        <tr key={p.id} className={`border-t border-outline-variant/40 ${i % 2 === 1 ? 'bg-surface-container-low/40' : ''}`}>
                          <td className="py-3 px-5 text-[13px] text-on-surface-variant">
                            {new Date(p.paidAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-4 text-[13px] font-medium text-on-surface">{p.user?.fullName ?? 'Deleted member'}</td>
                          <td className="py-3 px-4 text-[13px] font-semibold text-secondary dark:text-orange-400">
                            KES {Math.round(p.amount).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-[12px] text-on-surface-variant font-mono">{p.mpesaRef || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                failedPayments.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-16">
                    <span className="material-symbols-outlined icon-fill text-green-500" style={{ fontSize: 40 }}>check_circle</span>
                    <p className="text-sm text-on-surface-variant">No failed payments.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface dark:bg-[#0d1729] border-b border-outline-variant/60 z-10">
                      <tr className="text-left text-on-surface-variant">
                        <th className="py-2.5 px-5 font-semibold text-[12px]">Date</th>
                        <th className="py-2.5 px-4 font-semibold text-[12px]">Member</th>
                        <th className="py-2.5 px-4 font-semibold text-[12px]">Amount</th>
                        <th className="py-2.5 px-4 font-semibold text-[12px]">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failedPayments.map((f, i) => {
                        const meta = f.meta as { resultCode?: number; resultDesc?: string; amount?: number }
                        return (
                          <tr key={f.id} className={`border-t border-outline-variant/40 ${i % 2 === 1 ? 'bg-surface-container-low/40' : ''}`}>
                            <td className="py-3 px-5 text-[13px] text-on-surface-variant">
                              {new Date(f.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-3 px-4 text-[13px] font-medium text-on-surface">{f.user?.fullName ?? 'Deleted member'}</td>
                            <td className="py-3 px-4 text-[13px] text-on-surface-variant">
                              {meta.amount ? `KES ${Math.round(meta.amount).toLocaleString()}` : '—'}
                            </td>
                            <td className="py-3 px-4 text-[12px] text-red-600 dark:text-red-400 max-w-[180px]">
                              {errorLabel(meta.resultCode, meta.resultDesc)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-outline-variant dark:border-[#1a2d4f] shrink-0 flex items-center justify-between">
              <p className="text-[12px] text-on-surface-variant">{successRate}% success rate</p>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-outline-variant px-4 py-2 text-[13px] font-semibold text-on-surface hover:bg-surface-container transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
