'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { recordExpense, requestEvidenceUploadUrl } from '@/app/actions/finance'
import { uploadToSignedUrl } from '@/lib/upload-client'
import PaymentCategoryFields from '@/components/finance/PaymentCategoryFields'
import { MAX_AMOUNT_KES, amountError } from '@/lib/money-limits'
import { readableError } from '@/lib/form-errors'

type Category = { id: string; name: string }
type Account = { id: string; name: string }
type Project = { id: string; title: string }

export default function RecordExpenseForm({
  categories,
  accounts,
  projects = [],
  today,
}: {
  categories: Category[]
  accounts: Account[]
  projects?: Project[]
  today: string
}) {
  const router = useRouter()
  const [formKey, setFormKey] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const amountProblem = amountError(formData.get('amount'))
    if (amountProblem) {
      setError(amountProblem)
      return
    }
    setError('')
    setPending(true)
    try {
      const evidenceFile = formData.get('evidence') as File | null
      if (!evidenceFile || !evidenceFile.size) throw new Error('A supporting document is required for every expense.')

      const requestFd = new FormData()
      requestFd.set('fileName', evidenceFile.name)
      const { bucket, path, token } = await requestEvidenceUploadUrl(requestFd)
      await uploadToSignedUrl(bucket, path, token, evidenceFile)

      formData.delete('evidence')
      formData.set('evidencePath', path)
      formData.set('evidenceMimeType', evidenceFile.type || 'application/octet-stream')
      formData.set('evidenceTitle', evidenceFile.name)

      await recordExpense(formData)
      form.reset()
      setFormKey((key) => key + 1)
      router.refresh()
    } catch (cause) {
      setError(readableError(cause, 'Could not record this expense. Try again.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-2 md:grid-cols-3">
      <input name="amount" type="number" min="1" max={MAX_AMOUNT_KES} step="0.01" required disabled={pending} placeholder="Amount KES (max 999,999)" className="rounded-lg border px-3 py-2 disabled:opacity-60" />
      <input name="payee" required minLength={2} maxLength={160} disabled={pending} placeholder="Payee" className="rounded-lg border px-3 py-2 disabled:opacity-60" />
      <input name="purpose" required minLength={2} maxLength={500} disabled={pending} placeholder="Purpose" className="rounded-lg border px-3 py-2 disabled:opacity-60" />
      <PaymentCategoryFields key={formKey} categories={categories} kind="expense" projects={projects} descriptionPlaceholder="Short note about this expense" />
      <select name="sourceAccountId" required disabled={pending} className="rounded-lg border px-3 py-2 disabled:opacity-60">
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <input name="occurredAt" type="date" required disabled={pending} max={today} defaultValue={today} className="rounded-lg border px-3 py-2 disabled:opacity-60" />
      <label className="text-sm md:col-span-3">
        Supporting document
        <input name="evidence" type="file" required disabled={pending} accept=".pdf,image/*" className="mt-1 block disabled:opacity-60" />
      </label>
      {error && <p className="text-sm text-error md:col-span-3">{error}</p>}
      <button type="submit" disabled={pending} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-on-primary disabled:cursor-wait disabled:opacity-60 md:col-span-3">
        {pending && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
        {pending ? 'Recording…' : 'Record expense'}
      </button>
    </form>
  )
}
