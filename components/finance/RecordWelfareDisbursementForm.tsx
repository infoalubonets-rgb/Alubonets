'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { recordWelfareDisbursement, requestEvidenceUploadUrl } from '@/app/actions/finance'
import { uploadToSignedUrl } from '@/lib/upload-client'
import { todayInputValue } from '@/lib/dates'
import { MAX_AMOUNT_KES, amountError } from '@/lib/money-limits'
import { readableError } from '@/lib/form-errors'

type Account = { id: string; name: string }

export default function RecordWelfareDisbursementForm({
  welfareRequestId,
  defaultAmount,
  accounts,
}: {
  welfareRequestId: string
  defaultAmount: number | null | undefined
  accounts: Account[]
}) {
  const router = useRouter()
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
      if (!evidenceFile || !evidenceFile.size) throw new Error('A supporting document is required for every disbursement.')

      const requestFd = new FormData()
      requestFd.set('fileName', evidenceFile.name)
      const { bucket, path, token } = await requestEvidenceUploadUrl(requestFd)
      await uploadToSignedUrl(bucket, path, token, evidenceFile)

      formData.delete('evidence')
      formData.set('evidencePath', path)
      formData.set('evidenceMimeType', evidenceFile.type || 'application/octet-stream')
      formData.set('evidenceTitle', evidenceFile.name)

      await recordWelfareDisbursement(formData)
      form.reset()
      router.refresh()
    } catch (cause) {
      setError(readableError(cause, 'Could not record this payment. Try again.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-2 md:grid-cols-4">
      <input type="hidden" name="welfareRequestId" value={welfareRequestId} />
      <input name="amount" type="number" min="1" max={MAX_AMOUNT_KES} step="0.01" required disabled={pending} defaultValue={defaultAmount ?? undefined} placeholder="KES amount" className="rounded-lg border px-3 py-2 disabled:opacity-60" />
      <select name="sourceAccountId" required disabled={pending} className="rounded-lg border px-3 py-2 disabled:opacity-60">
        {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
      </select>
      <input name="occurredAt" type="date" required disabled={pending} max={todayInputValue()} title="A payment cannot be dated in the future." defaultValue={todayInputValue()} className="rounded-lg border px-3 py-2 disabled:opacity-60" />
      <input name="evidence" type="file" required disabled={pending} accept=".pdf,image/*" className="rounded-lg border px-3 py-2 disabled:opacity-60" />
      {error && <p className="text-sm text-error md:col-span-4">{error}</p>}
      <button type="submit" disabled={pending} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:cursor-wait disabled:opacity-60">
        {pending && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
        {pending ? 'Recording…' : 'Record payment'}
      </button>
    </form>
  )
}
