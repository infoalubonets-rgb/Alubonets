'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { publishFinanceDestination, updateFundAllocationRule } from '@/app/actions/finance'

type Destination = {
  bankName: string
  accountName: string
  accountNumber: string
  paybillOrTill: string | null
  branchName: string | null
  notes: string | null
} | null

type Rule = {
  emergencyPercent: number
  reservePercent: number
  version: number
} | null

export default function FinanceDestinationForm({
  destination,
  allocation,
}: {
  destination: Destination
  allocation: Rule
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  return (
    <div className="space-y-5">
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const formData = new FormData(event.currentTarget)
          setMessage('')
          setError('')
          startTransition(async () => {
            try {
              await publishFinanceDestination(formData)
              setMessage('Official payment destination saved (versioned).')
              router.refresh()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not save destination.')
            }
          })
        }}
      >
        <p className="text-xs text-on-surface-variant">
          Displayed to members for bank/M-Pesa payments. Every change is kept in history.
        </p>
        <input name="bankName" required defaultValue={destination?.bankName || ''} placeholder="Bank name" className="rounded-lg border px-3 py-2 text-sm" />
        <input name="accountName" required defaultValue={destination?.accountName || ''} placeholder="Account name" className="rounded-lg border px-3 py-2 text-sm" />
        <input name="accountNumber" required defaultValue={destination?.accountNumber || ''} placeholder="Account number" className="rounded-lg border px-3 py-2 text-sm" />
        <input name="paybillOrTill" defaultValue={destination?.paybillOrTill || ''} placeholder="Paybill / Till (optional)" className="rounded-lg border px-3 py-2 text-sm" />
        <input name="branchName" defaultValue={destination?.branchName || ''} placeholder="Branch (optional)" className="rounded-lg border px-3 py-2 text-sm" />
        <textarea name="notes" defaultValue={destination?.notes || ''} rows={2} placeholder="Notes (optional)" className="rounded-lg border px-3 py-2 text-sm" />
        <button disabled={pending} className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50">
          Save payment destination
        </button>
      </form>

      <form
        className="grid gap-3 border-t pt-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          const formData = new FormData(event.currentTarget)
          setMessage('')
          setError('')
          startTransition(async () => {
            try {
              await updateFundAllocationRule(formData)
              setMessage('Fund allocation rule updated.')
              router.refresh()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not save allocation rule.')
            }
          })
        }}
      >
        <p className="text-xs text-on-surface-variant md:col-span-2">
          Configurable emergency / reserve split (currently v{allocation?.version || 1}).
        </p>
        <label className="text-sm">
          Emergency %
          <input
            name="emergencyPercent"
            type="number"
            min={0}
            max={100}
            step={0.1}
            required
            defaultValue={allocation?.emergencyPercent ?? 20}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          Reserve %
          <input
            name="reservePercent"
            type="number"
            min={0}
            max={100}
            step={0.1}
            required
            defaultValue={allocation?.reservePercent ?? 80}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        <button disabled={pending} className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50 md:col-span-2">
          Save allocation rule
        </button>
      </form>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  )
}
