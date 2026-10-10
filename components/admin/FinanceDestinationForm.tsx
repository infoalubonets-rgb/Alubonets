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
  mpesaType: string | null
  mpesaNumber: string | null
  mpesaAccount: string | null
  mpesaName: string | null
  notes: string | null
} | null

type Rule = {
  emergencyPercent: number
  reservePercent: number
  version: number
} | null

type Fields = {
  bankName: string
  accountName: string
  accountNumber: string
  paybillOrTill: string
  branchName: string
  mpesaType: '' | 'TILL' | 'PAYBILL'
  mpesaNumber: string
  mpesaAccount: string
  mpesaName: string
  notes: string
}

const EMPTY: Fields = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  paybillOrTill: '',
  branchName: '',
  mpesaType: '',
  mpesaNumber: '',
  mpesaAccount: '',
  mpesaName: '',
  notes: '',
}

function initialFields(destination: Destination): Fields {
  if (!destination) return EMPTY
  const mpesaType = destination.mpesaType === 'TILL' || destination.mpesaType === 'PAYBILL' ? destination.mpesaType : ''
  return {
    bankName: destination.bankName || '',
    accountName: destination.accountName || '',
    accountNumber: destination.accountNumber || '',
    paybillOrTill: destination.paybillOrTill || '',
    branchName: destination.branchName || '',
    mpesaType,
    mpesaNumber: destination.mpesaNumber || '',
    mpesaAccount: destination.mpesaAccount || '',
    mpesaName: destination.mpesaName || '',
    notes: destination.notes || '',
  }
}

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm'
const labelClass = 'grid gap-1 text-xs font-medium text-on-surface-variant'

const kes = (value: number) => `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`

function roundPercent(value: number) {
  return Math.round(value * 10) / 10
}

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
  const [fields, setFields] = useState<Fields>(() => initialFields(destination))
  const [emergency, setEmergency] = useState(String(allocation?.emergencyPercent ?? 20))
  const [reserve, setReserve] = useState(String(allocation?.reservePercent ?? 80))

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setFields((prev) => ({ ...prev, [key]: value }))

  const emergencyNum = Number(emergency) || 0
  const reserveNum = Number(reserve) || 0
  const total = roundPercent(emergencyNum + reserveNum)

  return (
    <div className="space-y-6">
      <form
        className="grid gap-4"
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
          Shown to members on the Payment details button and PDF. Fill in the bank, an M-Pesa Till/Paybill, or both.
          Every change is kept in history.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <fieldset className="grid content-start gap-3 rounded-xl border border-outline-variant p-4">
            <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-primary">
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
              Bank account
            </legend>
            <label className={labelClass}>
              Bank name
              <input name="bankName" value={fields.bankName} onChange={(e) => set('bankName', e.target.value)} placeholder="e.g. Equity Bank" className={inputClass} />
            </label>
            <label className={labelClass}>
              Account name
              <input name="accountName" value={fields.accountName} onChange={(e) => set('accountName', e.target.value)} placeholder="Registered account name" className={inputClass} />
            </label>
            <label className={labelClass}>
              Account number
              <input name="accountNumber" value={fields.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} placeholder="Bank account number" className={inputClass} />
            </label>
            <label className={labelClass}>
              Bank paybill (optional)
              <input name="paybillOrTill" value={fields.paybillOrTill} onChange={(e) => set('paybillOrTill', e.target.value)} placeholder="Bank's M-Pesa paybill, e.g. 247247" className={inputClass} />
            </label>
            <label className={labelClass}>
              Branch (optional)
              <input name="branchName" value={fields.branchName} onChange={(e) => set('branchName', e.target.value)} placeholder="Branch name" className={inputClass} />
            </label>
          </fieldset>

          <fieldset className="grid content-start gap-3 rounded-xl border border-outline-variant p-4">
            <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-primary">
              <span className="material-symbols-outlined text-[18px]">smartphone</span>
              M-Pesa (direct to group)
            </legend>
            <input type="hidden" name="mpesaType" value={fields.mpesaType} />
            <div className={labelClass}>
              Type
              <div className="grid grid-cols-2 gap-2">
                {(['TILL', 'PAYBILL'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set('mpesaType', fields.mpesaType === type ? '' : type)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                      fields.mpesaType === type ? 'border-primary bg-primary text-on-primary' : 'text-on-surface'
                    }`}
                  >
                    {type === 'TILL' ? 'Till (Buy Goods)' : 'Paybill'}
                  </button>
                ))}
              </div>
            </div>
            <label className={labelClass}>
              {fields.mpesaType === 'PAYBILL' ? 'Paybill number' : fields.mpesaType === 'TILL' ? 'Till number' : 'Till / Paybill number'}
              <input
                name="mpesaNumber"
                inputMode="numeric"
                value={fields.mpesaNumber}
                onChange={(e) => set('mpesaNumber', e.target.value.replace(/\D/g, ''))}
                placeholder="Digits only"
                className={inputClass}
              />
            </label>
            {fields.mpesaType === 'PAYBILL' && (
              <label className={labelClass}>
                Account number members enter
                <input name="mpesaAccount" value={fields.mpesaAccount} onChange={(e) => set('mpesaAccount', e.target.value)} placeholder="e.g. member ID or ALUBONETS" className={inputClass} />
              </label>
            )}
            <label className={labelClass}>
              Business name shown on M-Pesa (optional)
              <input name="mpesaName" value={fields.mpesaName} onChange={(e) => set('mpesaName', e.target.value)} placeholder="Name members should see before confirming" className={inputClass} />
            </label>
          </fieldset>
        </div>

        <label className={labelClass}>
          Notes (optional)
          <textarea name="notes" value={fields.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="e.g. Use your phone number as reference" className={inputClass} />
        </label>

        <div className="flex flex-wrap gap-2">
          <button disabled={pending} className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50">
            Save payment destination
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setFields(EMPTY)
              setMessage('')
              setError('')
            }}
            className="inline-flex items-center gap-1 rounded-full border border-outline-variant px-4 py-2 text-sm text-on-surface disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">backspace</span>
            Clear form
          </button>
        </div>
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
        <div className="space-y-1.5 rounded-xl bg-surface-container-low px-3 py-2.5 text-xs text-on-surface-variant md:col-span-2">
          <p className="font-semibold text-on-surface">How the Emergency / Reserve split works (currently v{allocation?.version || 1})</p>
          <p>
            Every contribution recorded is split on paper into two portions: an <b>Emergency</b> fund amount and a{' '}
            <b>Reserve</b> fund amount, using the percentages below.
          </p>
          <p>
            Example: a member pays {kes(1000)} → {kes((1000 * emergencyNum) / 100)} is tagged Emergency and{' '}
            {kes((1000 * reserveNum) / 100)} Reserve.
          </p>
          <p>
            This is bookkeeping only: no money moves between accounts. A change applies to contributions recorded
            after you save; earlier contributions keep the split they were recorded with. The two values must add up to 100%.
          </p>
        </div>
        <label className="text-sm">
          Emergency %
          <input
            name="emergencyPercent"
            type="number"
            min={0}
            max={100}
            step={0.1}
            required
            value={emergency}
            onChange={(e) => {
              setEmergency(e.target.value)
              const n = Number(e.target.value)
              if (e.target.value !== '' && n >= 0 && n <= 100) setReserve(String(roundPercent(100 - n)))
            }}
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
            value={reserve}
            onChange={(e) => {
              setReserve(e.target.value)
              const n = Number(e.target.value)
              if (e.target.value !== '' && n >= 0 && n <= 100) setEmergency(String(roundPercent(100 - n)))
            }}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        {total !== 100 && (
          <p className="text-xs text-error md:col-span-2">Emergency and Reserve add up to {total}% — they must total 100%.</p>
        )}
        <button
          disabled={pending || total !== 100}
          className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50 md:col-span-2"
        >
          Save allocation rule
        </button>
      </form>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  )
}
