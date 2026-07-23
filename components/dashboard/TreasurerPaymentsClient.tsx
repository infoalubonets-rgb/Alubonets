'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ContributionTrendChart } from './Charts'
import {
  actionDeleteFailedPayment,
  actionDeleteFailedPayments,
  actionDeleteAllFailedPayments,
} from '@/app/actions/payments'
import type { Prisma } from '@prisma/client'

const MPESA_ERRORS: Record<number, string> = {
  1:    'Insufficient funds in M-Pesa account',
  1001: 'Another transaction already in progress for this subscriber',
  1019: 'Transaction expired — user did not respond in time',
  1032: 'Request cancelled by user or PIN prompt timed out',
  1037: 'User unreachable — device offline or no network',
  2001: 'Wrong M-Pesa PIN entered',
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
  description: string | null
  user: { fullName: string; email: string }
}

type FailedPayment = {
  id: string
  createdAt: string
  meta: Prisma.JsonObject
  user: { fullName: string; email: string }
}

type Props = {
  successPayments: SuccessPayment[]
  failedPayments: FailedPayment[]
  chartLabels: string[]
  chartValues: number[]
}

type DateFilter = 'all' | '7d' | '1m'

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d
}

export default function TreasurerPaymentsClient({ successPayments, failedPayments, chartLabels, chartValues }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Filters for success table
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')

  // Failed payments selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [openModal, setOpenModal] = useState<FailedPayment | null>(null)
  const [deleteError, setDeleteError] = useState('')

  // Stats
  const totalAmount = successPayments.reduce((s, p) => s + p.amount, 0)
  const total = successPayments.length
  const failed = failedPayments.length
  const successRate = total + failed > 0 ? Math.round((total / (total + failed)) * 100) : 100

  // Filter successful payments by date
  const filteredSuccess = useMemo(() => {
    if (dateFilter === 'all') return successPayments
    const cutoff = dateFilter === '7d' ? daysAgo(7) : daysAgo(30)
    return successPayments.filter((p) => new Date(p.paidAt) >= cutoff)
  }, [successPayments, dateFilter])

  // Bulk selection helpers
  const allSelected = failedPayments.length > 0 && selectedIds.size === failedPayments.length
  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(failedPayments.map((f) => f.id)))
  }
  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Delete actions
  function doDeleteOne(id: string) {
    setDeleteError('')
    startTransition(async () => {
      try {
        await actionDeleteFailedPayment(id)
        setOpenModal(null)
        setSelectedIds((p) => { const n = new Set(p); n.delete(id); return n })
        router.refresh()
      } catch { setDeleteError('Delete failed. Please try again.') }
    })
  }

  function doDeleteSelected() {
    const ids = [...selectedIds]
    if (!ids.length) return
    setDeleteError('')
    startTransition(async () => {
      try {
        await actionDeleteFailedPayments(ids)
        setSelectedIds(new Set())
        router.refresh()
      } catch { setDeleteError('Delete failed. Please try again.') }
    })
  }

  function doDeleteAll() {
    setDeleteError('')
    startTransition(async () => {
      try {
        await actionDeleteAllFailedPayments()
        setSelectedIds(new Set())
        router.refresh()
      } catch { setDeleteError('Delete failed. Please try again.') }
    })
  }

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total M-Pesa (KES)', value: Math.round(totalAmount).toLocaleString(), icon: 'payments', color: 'text-primary' },
          { label: 'Successful', value: total.toLocaleString(), icon: 'check_circle', color: 'text-green-600' },
          { label: 'Failed', value: failed.toLocaleString(), icon: 'cancel', color: failed > 0 ? 'text-red-500' : 'text-on-surface-variant' },
          { label: 'Success rate', value: `${successRate}%`, icon: 'trending_up', color: successRate >= 80 ? 'text-green-600' : 'text-secondary' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className={`material-symbols-outlined icon-fill ${s.color}`} style={{ fontSize: 16 }}>{s.icon}</span>
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wide font-semibold">{s.label}</p>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
        <h2 className="font-semibold text-sm text-on-surface mb-4">M-Pesa collection — last 6 months</h2>
        <ContributionTrendChart
          labels={chartLabels.length ? chartLabels : ['—']}
          values={chartValues.length ? chartValues : [0]}
        />
      </div>

      {/* Successful payments */}
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
        <div className="px-5 py-3 border-b border-outline-variant bg-surface-container-low flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-sm text-on-surface">Successful M-Pesa payments</h2>
          <div className="flex gap-1.5">
            {(['all', '7d', '1m'] as DateFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  dateFilter === f
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface border-outline-variant text-on-surface-variant hover:border-primary/40'
                }`}
              >
                {f === 'all' ? 'All time' : f === '7d' ? 'Last 7 days' : 'Last month'}
              </button>
            ))}
          </div>
        </div>

        {filteredSuccess.length === 0 ? (
          <p className="px-5 py-10 text-sm text-on-surface-variant text-center">No M-Pesa payments in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-on-surface-variant border-b border-outline-variant/60">
                  <th className="py-3 px-4 font-semibold text-[12px]">Date</th>
                  <th className="py-3 px-4 font-semibold text-[12px]">Member</th>
                  <th className="py-3 px-4 font-semibold text-[12px]">Amount</th>
                  <th className="py-3 px-4 font-semibold text-[12px]">M-Pesa Ref</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuccess.map((p, i) => (
                  <tr key={p.id} className={`border-t border-outline-variant/40 ${i % 2 === 1 ? 'bg-surface-container-low/50' : ''}`}>
                    <td className="py-3 px-4 text-[13px]">
                      {new Date(p.paidAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-4 text-[13px]">{p.user.fullName}</td>
                    <td className="py-3 px-4 text-[13px] font-semibold text-secondary">KES {Math.round(p.amount).toLocaleString()}</td>
                    <td className="py-3 px-4 text-[12px] text-on-surface-variant font-mono">{p.mpesaRef || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Failed payments */}
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
        <div className="px-5 py-3 border-b border-outline-variant bg-surface-container-low flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined icon-fill text-red-500" style={{ fontSize: 18 }}>cancel</span>
            <h2 className="font-semibold text-sm text-on-surface">Failed payments</h2>
            {failed > 0 && (
              <span className="text-[11px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-semibold px-2 py-0.5 rounded-full">
                {failed}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={doDeleteSelected}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-[12px] font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                Delete selected ({selectedIds.size})
              </button>
            )}
            {failed > 0 && (
              <button
                onClick={doDeleteAll}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 dark:border-red-800 dark:text-red-400 text-[12px] font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete_sweep</span>
                Clear all
              </button>
            )}
          </div>
        </div>

        {deleteError && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            <span className="material-symbols-outlined icon-fill" style={{ fontSize: 14 }}>error</span>
            {deleteError}
          </div>
        )}

        {failedPayments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <span className="material-symbols-outlined icon-fill text-green-500" style={{ fontSize: 36 }}>check_circle</span>
            <p className="text-sm text-on-surface-variant">No failed payments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-on-surface-variant border-b border-outline-variant/60">
                  <th className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-outline-variant accent-primary"
                    />
                  </th>
                  <th className="py-3 px-4 font-semibold text-[12px]">Date</th>
                  <th className="py-3 px-4 font-semibold text-[12px]">Member</th>
                  <th className="py-3 px-4 font-semibold text-[12px]">Amount</th>
                  <th className="py-3 px-4 font-semibold text-[12px]">Reason</th>
                  <th className="py-3 px-4 font-semibold text-[12px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {failedPayments.map((f, i) => {
                  const meta = f.meta as { resultCode?: number; resultDesc?: string; amount?: number; phone?: string }
                  const code = meta.resultCode
                  return (
                    <tr key={f.id} className={`border-t border-outline-variant/40 ${i % 2 === 1 ? 'bg-surface-container-low/50' : ''}`}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(f.id)}
                          onChange={() => toggleOne(f.id)}
                          className="rounded border-outline-variant accent-primary"
                        />
                      </td>
                      <td className="py-3 px-4 text-[13px]">
                        {new Date(f.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 text-[13px]">{f.user.fullName}</td>
                      <td className="py-3 px-4 text-[13px] font-semibold text-on-surface-variant">
                        {meta.amount ? `KES ${Math.round(meta.amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-[12px] text-red-600 dark:text-red-400 max-w-[200px] truncate">
                        {errorLabel(code, meta.resultDesc)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setOpenModal(f)}
                            title="View details"
                            className="flex items-center justify-center h-7 w-7 rounded-lg text-on-surface-variant hover:bg-surface-container border border-outline-variant transition-colors"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>
                          </button>
                          <button
                            onClick={() => doDeleteOne(f.id)}
                            disabled={isPending}
                            title="Delete"
                            className="flex items-center justify-center h-7 w-7 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Failed payment detail modal */}
      {openModal && (() => {
        const f = openModal
        const meta = f.meta as { resultCode?: number; resultDesc?: string; amount?: number; phone?: string; checkoutRequestId?: string }
        const code = meta.resultCode
        const reason = errorLabel(code, meta.resultDesc)
        return (
          <div
            className="fixed inset-0 z-[150] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,31,80,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setOpenModal(null) }}
          >
            <div className="w-full max-w-md rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] shadow-2xl">

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-outline-variant dark:border-[#1a2d4f]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                    <span className="material-symbols-outlined icon-fill text-red-500" style={{ fontSize: 18 }}>cancel</span>
                  </div>
                  <h2 className="font-semibold text-[15px] text-on-surface dark:text-blue-50">Payment Failed</h2>
                </div>
                <button
                  onClick={() => setOpenModal(null)}
                  className="flex items-center justify-center h-7 w-7 rounded-full text-on-surface-variant hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Error icon + message */}
                <div className="flex flex-col items-center gap-3 py-3 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <span className="material-symbols-outlined icon-fill text-red-500" style={{ fontSize: 32 }}>error</span>
                  </div>
                  {code !== undefined && (
                    <span className="text-[11px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full">
                      Error {code}
                    </span>
                  )}
                  <p className="text-[14px] font-semibold text-on-surface dark:text-blue-50">{reason}</p>
                </div>

                {/* Details grid */}
                <div className="rounded-xl border border-outline-variant dark:border-[#1a2d4f] bg-surface-container dark:bg-[#111f36] divide-y divide-outline-variant dark:divide-[#1a2d4f]">
                  {[
                    { label: 'Member', value: f.user.fullName },
                    { label: 'Email', value: f.user.email },
                    { label: 'Amount', value: meta.amount ? `KES ${Math.round(meta.amount).toLocaleString()}` : '—' },
                    { label: 'Phone', value: meta.phone || '—' },
                    { label: 'Date', value: new Date(f.createdAt).toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                    ...(meta.checkoutRequestId ? [{ label: 'Reference', value: meta.checkoutRequestId }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start justify-between gap-3 px-4 py-2.5">
                      <span className="text-[12px] text-on-surface-variant shrink-0">{label}</span>
                      <span className="text-[12px] font-medium text-on-surface dark:text-blue-50 text-right break-all">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setOpenModal(null)}
                    className="flex-1 rounded-xl border border-outline-variant py-2.5 text-[13px] font-semibold text-on-surface hover:bg-surface-container transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => doDeleteOne(f.id)}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-500 text-white py-2.5 text-[13px] font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                    Delete record
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
