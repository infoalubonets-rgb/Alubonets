'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { recordLedgerContribution, requestEvidenceUploadUrl } from '@/app/actions/finance'
import { uploadToSignedUrlWithProgress } from '@/lib/upload-client'
import PaymentCategoryFields from '@/components/finance/PaymentCategoryFields'

type Member = { id: string; fullName: string; membershipNumber: string | null }
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
}: {
  members: Member[]
  campaigns: Campaign[]
  categories: Category[]
  accounts: Account[]
  projects?: Project[]
  /** Today's date in the group's timezone (YYYY-MM-DD). */
  today: string
}) {
  const router = useRouter()
  const [billingKind, setBillingKind] = useState('NONE')
  const [formKey, setFormKey] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<{ percent: number; status: string } | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const form = event.currentTarget
      const formData = new FormData(form)
      const evidenceFile = formData.get('evidence') as File | null
      if (!evidenceFile || !evidenceFile.size) {
        throw new Error('A receipt or proof of payment is required for every contribution.')
      }

      setProgress({ percent: 0, status: 'Uploading proof…' })
      const requestFd = new FormData()
      requestFd.set('fileName', evidenceFile.name)
      const { bucket, path, token } = await requestEvidenceUploadUrl(requestFd)
      await uploadToSignedUrlWithProgress(bucket, path, token, evidenceFile, (percent) =>
        setProgress({ percent, status: `Uploading proof… ${percent}%` }),
      )

      formData.delete('evidence')
      formData.set('evidencePath', path)
      formData.set('evidenceMimeType', evidenceFile.type || 'application/octet-stream')
      formData.set('evidenceTitle', evidenceFile.name)

      await recordLedgerContribution(formData)
      form.reset()
      setFormKey((key) => key + 1)
      setBillingKind('NONE')
      setProgress(null)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record this contribution. Try again.')
      setProgress(null)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-2 md:grid-cols-3">
      <select name="userId" required disabled={pending} className="rounded-lg border px-3 py-2 disabled:opacity-60">
        {members.map((m) => <option key={m.id} value={m.id}>{m.membershipNumber || '—'} · {m.fullName}</option>)}
      </select>
      <PaymentCategoryFields
        key={formKey}
        categories={categories}
        kind="income"
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
      <input name="amount" type="number" min="1" required disabled={pending} placeholder="Amount KES" className="rounded-lg border px-3 py-2 disabled:opacity-60" />
      <select name="sourceAccountId" required disabled={pending} className="rounded-lg border px-3 py-2 disabled:opacity-60">
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <select name="paymentMethod" disabled={pending} className="rounded-lg border px-3 py-2 disabled:opacity-60">
        <option>CASH</option><option>MPESA</option><option>BANK</option><option>OTHER</option>
      </select>
      <input name="providerReference" disabled={pending} placeholder="Unique transaction reference" className="rounded-lg border px-3 py-2 disabled:opacity-60" />
      <label className="text-sm">
        Date paid (past dates allowed for backdating)
        <input name="occurredAt" type="date" required disabled={pending} max={today} defaultValue={today} className="mt-1 block w-full rounded-lg border px-3 py-2 disabled:opacity-60" />
      </label>
      <label className="text-sm md:col-span-3">
        Receipt / proof of payment
        <input type="file" name="evidence" required disabled={pending} accept=".pdf,image/*" className="mt-1 block w-full text-sm disabled:opacity-60" />
      </label>
      {progress && (
        <div className="md:col-span-3 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="text-xs text-on-surface-variant">{progress.status}</p>
        </div>
      )}
      {error && <p className="text-sm text-error md:col-span-3">{error}</p>}
      <button type="submit" disabled={pending} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-on-primary disabled:cursor-wait disabled:opacity-60 md:col-span-3">
        {pending && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
        {pending ? 'Recording…' : 'Record contribution'}
      </button>
    </form>
  )
}
