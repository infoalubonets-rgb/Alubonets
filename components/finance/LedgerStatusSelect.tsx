'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveFinancialTransaction, approveReversal, proposeReversal, returnTransactionToPending } from '@/app/actions/finance'

export default function LedgerStatusSelect({ id, status, type, canApprove, canReverse, reversalPending, onDone }: {
  id: string; status: string; type: string; canApprove: boolean; canReverse: boolean; reversalPending: boolean; onDone?: () => void
}) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [requested, setRequested] = useState(false)
  const value = ['CONFIRMED', 'RECONCILED'].includes(status) ? 'APPROVED' : status
  const reversing = reversalPending || requested
  const change = (next: string) => {
    if (next === value) return
    setError('')
    startTransition(async () => {
      try {
        const data = new FormData()
        data.set('id', id)
        if (next === 'REVERSED') {
          data.set('reason', 'Reversal requested through transaction status dropdown')
          await proposeReversal(data)
          setRequested(true)
        } else if (next === 'PENDING') {
          await returnTransactionToPending(data)
        } else if (next === 'APPROVED') {
          await (type === 'REVERSAL' ? approveReversal(data) : approveFinancialTransaction(data))
        }
        onDone?.()
        router.refresh()
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not update status.') }
    })
  }
  return <div className="shrink-0 text-right">
    <select aria-label="Transaction status" value={value} onChange={e => change(e.target.value)} disabled={busy || (!canApprove && !canReverse)} className="!h-8 !w-[110px] !min-w-0 rounded-lg border border-outline-variant bg-surface !px-2 !py-1 text-xs text-primary disabled:opacity-70">
      <option value="APPROVED" disabled={value !== 'APPROVED' && !(status === 'PENDING' && canApprove)}>Approved</option>
      {/* The Treasurer can send an approved (not reconciled) entry back for approval. */}
      <option value="PENDING" disabled={status !== 'PENDING' && !(status === 'CONFIRMED' && canReverse && type !== 'REVERSAL' && !reversing)}>Pending</option>
      <option value="REVERSED" disabled={status !== 'REVERSED' && (!canReverse || reversing || !['CONFIRMED', 'RECONCILED'].includes(status))}>Reversed</option>
      {!['APPROVED', 'PENDING', 'REVERSED'].includes(value) && <option value={value}>{status.charAt(0) + status.slice(1).toLowerCase()}</option>}
    </select>
    {reversing && <p className="mt-1 text-[10px] text-amber-700">Reversal pending approval</p>}
    {error && <p role="alert" className="mt-1 max-w-52 text-xs text-error">{error}</p>}
  </div>
}

