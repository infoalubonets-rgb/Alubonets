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

type SaveJob = {
  id: number
  label: string
  state: 'saving' | 'done' | 'error'
  note?: string
  error?: string
  /** Kept on failure so Retry can send exactly the same payment again. */
  formData?: FormData
}

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
  // Saving runs in the background, so the form is never locked while a payment is sent.
  const pending = false
  const [error, setError] = useState('')
  const [proofName, setProofName] = useState('')
  const [jobs, setJobs] = useState<SaveJob[]>([])
  const updateJob = (id: number, patch: Partial<SaveJob>) =>
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)))

  /** Uploads any proof, then records the payment; updates the job's status as it goes. */
  async function save(jobId: number, formData: FormData) {
    updateJob(jobId, { state: 'saving', error: undefined, note: undefined })
    try {
      const evidenceFile = formData.get('evidence') as File | null
      if (evidenceFile?.size) {
        const requestFd = new FormData()
        requestFd.set('fileName', evidenceFile.name)
        const { bucket, path, token } = await requestEvidenceUploadUrl(requestFd)
        await uploadToSignedUrlWithProgress(bucket, path, token, evidenceFile, (percent) =>
          updateJob(jobId, { note: `uploading proof ${percent}%` }),
        )
        formData.set('evidencePath', path)
        formData.set('evidenceMimeType', evidenceFile.type)
        formData.set('evidenceTitle', evidenceFile.name)
        formData.delete('evidence')
        updateJob(jobId, { note: undefined })
      }
      await recordLedgerContribution(formData)
      updateJob(jobId, { state: 'done' })
      // Reload the totals, tables and history behind the pop-up.
      router.refresh()
    } catch (cause) {
      updateJob(jobId, { state: 'error', note: undefined, error: readableError(cause, 'Could not record this contribution.'), formData })
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const problem = missingDetail(formData)
    if (problem) {
      setError(problem)
      return
    }
    const evidenceFile = formData.get('evidence') as File | null
    if (evidenceFile?.size && (!/\.(pdf|png|webp|jpe?g)$/i.test(evidenceFile.name) || !['application/pdf', 'image/png', 'image/webp', 'image/jpeg'].includes(evidenceFile.type))) {
      setError('Upload a PDF, PNG, WebP, JPEG or JPG file.')
      return
    }
    if (!evidenceFile?.size) formData.delete('evidence')
    const customMethod = String(formData.get('customMethod') || '').trim()
    if (method === 'OTHER' && customMethod) {
      formData.set('description', [formData.get('description'), `Payment method: ${customMethod}`].filter(Boolean).join(' · '))
    }
    setError('')

    const payer = members.find((m) => m.id === formData.get('userId'))?.fullName ?? 'Member'
    const label = `KES ${Number(formData.get('amount') || 0).toLocaleString('en-KE')} · ${payer}`
    const id = Date.now() + Math.random()
    setJobs((current) => [{ id, label, state: 'saving' as const }, ...current].slice(0, 6))

    // Clear the form straight away so the next payment can be entered while this one saves.
    form.reset()
    setFormKey((key) => key + 1)
    setBillingKind('NONE')
    setProofName('')
    setMethod('MPESA')
    void save(id, formData)
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
      {error && <p className="text-sm text-error md:col-span-2">{error}</p>}
      {jobs.length > 0 && (
        <ul className="space-y-1.5 md:col-span-2" aria-live="polite">
          {jobs.map((job) => (
            <li
              key={job.id}
              className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                job.state === 'done'
                  ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200'
                  : job.state === 'error'
                    ? 'bg-error-container text-on-error-container'
                    : 'bg-surface-container-high text-on-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${job.state === 'saving' ? 'animate-spin' : ''}`}>
                {job.state === 'done' ? 'check_circle' : job.state === 'error' ? 'error' : 'progress_activity'}
              </span>
              <span className="font-semibold">{job.label}</span>
              <span className="text-xs">
                {job.state === 'done' ? 'Recorded' : job.state === 'error' ? job.error : `Saving${job.note ? ` — ${job.note}` : '…'}`}
              </span>
              {job.state === 'error' && job.formData && (
                <button type="button" onClick={() => void save(job.id, job.formData!)} className="ml-auto rounded-full bg-primary px-3 py-1 text-xs font-semibold text-on-primary">
                  Retry
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end border-t border-outline-variant/50 pt-4 md:col-span-2">
        <button type="submit" disabled={pending} className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:cursor-wait disabled:opacity-60 sm:w-auto">
          Record contribution
        </button>
      </div>
    </form>
  )
}
