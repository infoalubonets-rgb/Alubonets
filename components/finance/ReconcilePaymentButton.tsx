'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { reconcileContribution } from '@/app/actions/finance'

export type ReconcilePayment = {
  id: string
  memberName: string
  amount: number
  paidAt: string
  method: string
  reference: string | null
  statementRef: string | null
  purpose: string
  status: string
}

export type ReconciliationInfo = { notes: string; reconciledAt: string; reconciledBy: string } | null

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="text-sm font-medium text-on-surface">{value}</p>
    </div>
  )
}

export default function ReconcilePaymentButton({ payment, reconciliation }: { payment: ReconcilePayment; reconciliation: ReconciliationInfo }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const canReconcile = payment.status === 'CONFIRMED'
  const isReconciled = payment.status === 'RECONCILED'
  if (!canReconcile && !isReconciled) return <span className="text-xs text-on-surface-variant">—</span>

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await reconcileContribution(new FormData(event.currentTarget))
      setOpen(false)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reconcile this payment.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {canReconcile ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
        >
          Reconcile
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          <span className="material-symbols-outlined text-[14px]">task_alt</span>
          Reconciled
        </button>
      )}

      <FullScreenModal open={open} title={canReconcile ? 'Reconcile payment' : 'Reconciliation'} onClose={() => setOpen(false)} size="compact">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-outline-variant/60 bg-surface-container-low p-4">
            <Detail label="Member" value={payment.memberName} />
            <Detail label="Amount" value={`KES ${payment.amount.toLocaleString()}`} />
            <Detail label="Purpose" value={payment.purpose} />
            <Detail label="Paid" value={new Date(payment.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
            <Detail label="Method" value={payment.method} />
            <Detail label="Reference" value={payment.reference || '—'} />
          </div>

          {isReconciled ? (
            <div className="grid grid-cols-2 gap-3">
              <Detail label="Statement ref" value={payment.statementRef || '—'} />
              <Detail
                label="Reconciled"
                value={reconciliation ? `${new Date(reconciliation.reconciledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} by ${reconciliation.reconciledBy}` : '—'}
              />
              <div className="col-span-2">
                <Detail label="Notes" value={reconciliation?.notes || '—'} />
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <input type="hidden" name="id" value={payment.id} />
              <label className="block text-sm font-semibold">
                Statement reference (optional)
                <input
                  name="statementRef"
                  maxLength={120}
                  defaultValue={payment.statementRef ?? ''}
                  placeholder="Bank / M-Pesa statement line"
                  className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                Notes
                <textarea
                  name="notes"
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={3}
                  placeholder="e.g. Matched to September bank statement"
                  className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal"
                />
              </label>
              {error && <p className="text-sm text-error">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60">
                  {pending ? 'Saving…' : 'Mark reconciled'}
                </button>
              </div>
            </form>
          )}
        </div>
      </FullScreenModal>
    </>
  )
}
