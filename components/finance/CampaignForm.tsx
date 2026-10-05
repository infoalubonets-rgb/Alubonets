'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createContributionCampaign, updateContributionCampaign } from '@/app/actions/finance'

type Category = { id: string; name: string }

export type CampaignFormInitial = {
  id: string
  title: string
  description: string | null
  targetAmount: number
  perMemberTarget: number | null
  categoryId: string
  startsAt: string
  dueAt: string | null
}

export default function CampaignForm({
  categories,
  today,
  initial,
  onSaved,
}: {
  categories: Category[]
  today: string
  initial?: CampaignFormInitial
  onSaved?: () => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaved(false)
    setPending(true)
    try {
      const form = event.currentTarget
      const formData = new FormData(form)
      if (initial) {
        formData.set('campaignId', initial.id)
        await updateContributionCampaign(formData)
      } else {
        await createContributionCampaign(formData)
        form.reset()
      }
      setSaved(true)
      router.refresh()
      onSaved?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this campaign. Try again.')
    } finally {
      setPending(false)
    }
  }

  const input = 'mt-1 block w-full rounded-lg border px-3 py-1.5 text-sm font-normal disabled:opacity-60'

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">
        Title
        <input name="title" required disabled={pending} defaultValue={initial?.title} placeholder="e.g. Contribution 3" className={input} />
      </label>
      <label className="text-sm font-semibold">
        Purpose
        <select name="categoryId" required disabled={pending} defaultValue={initial?.categoryId} className={input}>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Total target (KES)
        <input name="targetAmount" type="number" min="1" step="1" required disabled={pending} defaultValue={initial?.targetAmount} placeholder="500000" className={input} />
      </label>
      <label className="text-sm font-semibold">
        Per member (KES, optional)
        <input name="perMemberTarget" type="number" min="1" step="1" disabled={pending} defaultValue={initial?.perMemberTarget ?? undefined} placeholder="5000" className={input} />
      </label>
      <label className="text-sm font-semibold">
        Starts
        <input name="startsAt" type="date" required disabled={pending} defaultValue={initial?.startsAt ?? today} className={input} />
      </label>
      <label className="text-sm font-semibold">
        Due (optional)
        <input name="dueAt" type="date" disabled={pending} defaultValue={initial?.dueAt ?? undefined} className={input} />
      </label>
      <label className="text-sm font-semibold sm:col-span-2">
        Notes
        <textarea name="description" rows={2} disabled={pending} defaultValue={initial?.description ?? ''} placeholder="Optional" className={input} />
      </label>
      {error && <p className="text-sm text-error sm:col-span-2">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-700 sm:col-span-2">Saved.</p>}
      <button type="submit" disabled={pending} className="w-fit rounded-full bg-primary px-4 py-2 text-on-primary disabled:cursor-wait disabled:opacity-60 sm:col-span-2">
        {pending ? 'Saving…' : initial ? 'Save' : 'Create'}
      </button>
    </form>
  )
}
