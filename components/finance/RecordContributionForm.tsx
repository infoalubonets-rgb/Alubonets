'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { recordLedgerContribution, requestEvidenceUploadUrl } from '@/app/actions/finance'
import { uploadToSignedUrlWithProgress } from '@/lib/upload-client'
import PaymentCategoryFields from '@/components/finance/PaymentCategoryFields'
import { MAX_AMOUNT_KES, amountError } from '@/lib/money-limits'
import { readableError } from '@/lib/form-errors'

type Member = { id: string; fullName: string; email?: string; membershipNumber: string | null }
type Campaign = { id: string; title: string; categoryId: string }
type Category = { id: string; name: string; billingKind?: string | null }
type Account = { id: string; name: string }
type Project = { id: string; title: string }

export default function RecordContributionForm({
  members,
  campaigns,
  categories,
  accounts,
  projects = [],
  today,
  currentUserId,
}: {
  members: Member[]
  campaigns: Campaign[]
  categories: Category[]
  accounts: Account[]
  projects?: Project[]
  /** Today's date in the group's timezone (YYYY-MM-DD). */
  today: string
  currentUserId?: string
}) {
  const router = useRouter()
  const [method, setMethod] = useState('MPESA')
  const [billingKind, setBillingKind] = useState('NONE')
  const [formKey, setFormKey] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<{ percent: number; status: string } | null>(null)
  const [proofName, setProofName] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const problem = missingDetail(formData)
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    setPending(true)
    try {
      const evidenceFile = formData.get('evidence') as File | null
      const customMethod = String(formData.get('customMethod') || '').trim()
      if (method === 'OTHER' && customMethod) {
        formData.set('description', [formData.get('description'), `Payment method: ${customMethod}`].filter(Boolean).join(' · '))
      }
      if (evidenceFile?.size) {
        if (!/\.(pdf|png|webp|jpe?g)$/i.test(evidenceFile.name) || !['application/pdf', 'image/png', 'image/webp', 'image/jpeg'].includes(evidenceFile.type)) {
          throw new Error('Upload a PDF, PNG, WebP, JPEG or JPG file.')
        }
        setProgress({ percent: 0, status: 'Uploading proof…' })
        const requestFd = new FormData()
        requestFd.set('fileName', evidenceFile.name)
        const { bucket, path, token } = await requestEvidenceUploadUrl(requestFd)
        await uploadToSignedUrlWithProgress(bucket, path, token, evidenceFile, (percent) =>
          setProgress({ percent, status: `Uploading proof… ${percent}%` }),
        )
        formData.set('evidencePath', path)
        formData.set('evidenceMimeType', evidenceFile.type)
        formData.set('evidenceTitle', evidenceFile.name)
      }
      formData.delete('evidence')

      await recordLedgerContribution(formData)
      form.reset()
      setFormKey((key) => key + 1)
      setBillingKind('NONE')
      setProofName('')
      setProgress(null)
      router.refresh()
    } catch (cause) {
      setError(readableError(cause, 'Could not record this contribution. Try again.'))
      setProgress(null)
    } finally {
      setPending(false)
    }
  }

  /** Every field except proof and transaction reference must be filled before saving. */
  function missingDetail(formData: FormData) {
    const value = (name: string) => String(formData.get(name) ?? '').trim()
    if (!value('userId')) return 'Select the member.'
    const amountProblem = amountError(formData.get('amount'))
    if (amountProblem) return amountProblem
    if (!value('paymentMethod')) return 'Choose the payment method.'
    if (method === 'OTHER' && !value('customMethod')) return 'Type the payment method.'
    if (!value('categoryId')) return 'Choose the purpose of this payment.'
    if (billingKind === 'MONTHLY' && !value('contributionPeriod')) return 'Choose the month this payment covers.'
    if (!value('sourceAccountId')) return 'Choose the receiving account.'
    const paidOn = value('occurredAt')
    if (!paidOn) return 'Enter the date paid.'
    if (paidOn > today) return 'The date paid cannot be in the future.'
    if (value('providerReference').length > 100) return 'Transaction reference is too long (100 characters max).'
    return null
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <label className="text-sm">Member
        <select name="userId" required disabled={pending} defaultValue="" className="mt-1 w-full rounded-lg border px-3 py-2">
          <option value="" disabled>Select member</option>
          {members.filter((m) => m.id === currentUserId).map((m) => <option key={m.id} value={m.id}>My contribution — {m.fullName} — {m.email}</option>)}
          {members.filter((m) => m.id !== currentUserId).map((m) => <option key={m.id} value={m.id}>{m.fullName} — {m.email}</option>)}
        </select>
      </label>
      <label className="text-sm">Amount (KES)
        <input name="amount" type="number" min="1" max={MAX_AMOUNT_KES} step="0.01" required disabled={pending} placeholder="0.00" className="mt-1 w-full rounded-lg border px-3 py-2" />
        <span className="mt-1 block text-[11px] text-on-surface-variant">Up to KES 999,999.</span>
      </label>
      <label className="text-sm">Payment method
        <select name="paymentMethod" value={method} onChange={(e) => setMethod(e.target.value)} disabled={pending} className="mt-1 w-full rounded-lg border px-3 py-2">
          <option value="MPESA">M-Pesa</option><option value="BANK">Bank</option><option value="CASH">Cash</option><option value="OTHER">Other</option>
        </select>
      </label>
      {method === 'OTHER' && <label className="text-sm">Specify method
        <input name="customMethod" required maxLength={100} disabled={pending} placeholder="Type payment method" className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>}
      <PaymentCategoryFields
        key={formKey}
        categories={categories}
        kind="income"
        showDescription={false}
        campaigns={campaigns}
        projects={projects}
        onBillingKindChange={setBillingKind}
      />
      {billingKind === 'MONTHLY' && (
        <label className="text-sm">
          Month this payment covers
          <input name="contributionPeriod" type="month" required disabled={pending} defaultValue={today.slice(0, 7)} className="mt-1 block w-full rounded-lg border px-3 py-2 disabled:opacity-60" />
        </label>
      )}
      <div className="flex flex-col text-sm md:col-span-2">
        <span>Upload proof <span className="text-on-surface-variant">(optional)</span></span>
        <label
          className={`mt-1 flex flex-1 cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition ${
            proofName ? 'border-primary/50 bg-primary/5' : 'border-outline-variant hover:border-primary/60 hover:bg-primary/5'
          } ${pending ? 'pointer-events-none opacity-60' : ''}`}
        >
          <span className="material-symbols-outlined text-[28px] text-primary">{proofName ? 'task' : 'upload_file'}</span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-primary">{proofName || 'Choose a file'}</span>
            <span className="block text-[11px] text-on-surface-variant">{proofName ? 'Click to change' : 'PDF, PNG, WebP or JPG'}</span>
          </span>
          <input
            type="file"
            name="evidence"
            disabled={pending}
            accept=".pdf,.png,.webp,.jpeg,.jpg,application/pdf,image/png,image/webp,image/jpeg"
            onChange={(e) => setProofName(e.target.files?.[0]?.name ?? '')}
            className="sr-only"
          />
        </label>
      </div>
      {/* Required details stay visible so the form never fails on a field you can't see. */}
      <fieldset className="rounded-xl border border-outline-variant/60 px-3 pb-3 md:col-span-2">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Payment details</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Receiving account
            <select name="sourceAccountId" required disabled={pending} className="mt-1 w-full rounded-lg border px-3 py-2">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Date paid
            <input name="occurredAt" type="date" required disabled={pending} max={today} defaultValue={today} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm">Transaction reference <span className="text-on-surface-variant">(optional)</span>
            <input name="providerReference" maxLength={100} disabled={pending} placeholder="e.g. QJK4XYZ12" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
        </div>
      </fieldset>
      {progress && (
        <div className="md:col-span-2 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="text-xs text-on-surface-variant">{progress.status}</p>
        </div>
      )}
      {error && <p className="text-sm text-error md:col-span-2">{error}</p>}
      <div className="flex justify-end border-t border-outline-variant/50 pt-4 md:col-span-2">
        <button type="submit" disabled={pending} className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:cursor-wait disabled:opacity-60 sm:w-auto">
          {pending && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
          {pending ? 'Recording…' : 'Record contribution'}
        </button>
      </div>
    </form>
  )
}
