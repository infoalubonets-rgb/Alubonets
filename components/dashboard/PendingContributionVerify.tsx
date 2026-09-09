'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { verifyContribution } from '@/app/actions/finance'

type PendingRow = {
  id: string
  amount: number
  paidAt: string
  category: string | null
  memberName: string
  memberEmail: string
  paymentMethod: string
  mpesaRef: string | null
  statementRef: string | null
}

export default function PendingContributionVerify({ rows }: { rows: PendingRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  if (!rows.length) return null

  function decide(id: string, decision: 'verify' | 'reject', note?: string) {
    setError('')
    setOk('')
    const formData = new FormData()
    formData.set('id', id)
    formData.set('decision', decision)
    if (note) formData.set('note', note)
    startTransition(async () => {
      try {
        await verifyContribution(formData)
        setOk(decision === 'verify' ? 'Payment verified.' : 'Payment rejected.')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update payment.')
      }
    })
  }

  return (
    <section className="rounded-2xl border border-amber-300/60 bg-amber-50/40 p-4">
      <h2 className="font-h3 text-base text-primary">Pending payment verification</h2>
      <p className="mt-1 text-xs text-on-surface-variant">
        Member-submitted payments wait here until a Treasurer verifies or rejects them.
      </p>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
      {ok && <p className="mt-2 text-sm text-primary">{ok}</p>}
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-outline-variant bg-surface p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-on-surface">{row.memberName}</p>
                <p className="text-xs text-on-surface-variant">{row.memberEmail}</p>
                <p className="mt-1 text-sm">
                  KES {Math.round(row.amount).toLocaleString()} · {row.category || 'Uncategorized'} ·{' '}
                  {row.paymentMethod}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {new Date(row.paidAt).toLocaleString('en-KE')}
                  {row.mpesaRef ? ` · M-Pesa ${row.mpesaRef}` : ''}
                  {row.statementRef ? ` · Ref ${row.statementRef}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => decide(row.id, 'verify')}
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const note = window.prompt('Rejection note (optional)') || undefined
                    decide(row.id, 'reject', note)
                  }}
                  className="rounded-full border border-error/40 px-3 py-1.5 text-xs font-semibold text-error disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
