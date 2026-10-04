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
}: {
  categories: Category[]
  today: string
  initial?: CampaignFormInitial
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this campaign. Try again.')
    } finally {
      setPending(false)
    }
  }

  const input = 'mt-1 block w-full rounded-lg border px-3 py-2 font-normal disabled:opacity-60'

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-semibold">
        Campaign title
        <input name="title" required disabled={pending} defaultValue={initial?.title} placeholder="e.g. Contribution 3" className={input} />
      </label>
      <label className="text-sm font-semibold">
        Payment purpose
        <select name="categoryId" required disabled={pending} defaultValue={initial?.categoryId} className={input}>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Overall target (KES)
        <input name="targetAmount" type="number" min="1" step="1" required disabled={pending} defaultValue={initial?.targetAmount} placeholder="500000" className={input} />
        <span className="mt-1 block text-xs font-normal text-on-surface-variant">The total the society wants to raise. Drives the progress bar.</span>
      </label>
      <label className="text-sm font-semibold">
        Target per member (KES, optional)
        <input name="perMemberTarget" type="number" min="1" step="1" disabled={pending} defaultValue={initial?.perMemberTarget ?? undefined} placeholder="5000" className={input} />
        <span className="mt-1 block text-xs font-normal text-on-surface-variant">When set, every active member (and each newly approved member) gets this amount to pay.</span>
      </label>
      <label className="text-sm font-semibold">
        Start date
        <input name="startsAt" type="date" required disabled={pending} defaultValue={initial?.startsAt ?? today} className={input} />
        <span className="mt-1 block text-xs font-normal text-on-surface-variant">Past dates are allowed for campaigns that already started.</span>
      </label>
      <label className="text-sm font-semibold">
        Due date (optional)
        <input name="dueAt" type="date" disabled={pending} defaultValue={initial?.dueAt ?? undefined} className={input} />
      </label>
      <label className="text-sm font-semibold md:col-span-2">
        Notes for members
        <textarea name="description" rows={3} disabled={pending} defaultValue={initial?.description ?? ''} placeholder="What this campaign is for…" className={input} />
      </label>
      {error && <p className="text-sm text-error md:col-span-2">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-700 md:col-span-2">Saved.</p>}
      <button type="submit" disabled={pending} className="w-fit rounded-full bg-primary px-4 py-2 text-on-primary disabled:cursor-wait disabled:opacity-60 md:col-span-2">
        {pending ? 'Saving…' : initial ? 'Save changes' : 'Create campaign'}
      </button>
    </form>
  )
}
