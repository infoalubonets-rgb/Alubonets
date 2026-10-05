'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteContributionCampaigns } from '@/app/actions/finance'

export type CampaignRow = {
  id: string
  title: string
  categoryName: string
  startsAt: string
  dueAt: string | null
  target: number
  collected: number
  percent: number
  active: boolean
  payments: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CampaignsTable({ campaigns }: { campaigns: CampaignRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [confirming, setConfirming] = useState<CampaignRow[] | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const allSelected = campaigns.length > 0 && selected.length === campaigns.length
  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))

  function confirmDelete() {
    if (!confirming) return
    const ids = confirming.map((campaign) => campaign.id)
    setError('')
    setMessage('')
    startTransition(async () => {
      try {
        const { deleted, skipped } = await deleteContributionCampaigns(ids)
        setSelected((current) => current.filter((id) => !ids.includes(id)))
        setMessage(
          [
            deleted ? `${deleted} campaign${deleted === 1 ? '' : 's'} deleted.` : '',
            skipped.length
              ? `Kept ${skipped.join(', ')} — ${skipped.length === 1 ? 'it has' : 'they have'} recorded payments; deactivate instead.`
              : '',
          ].filter(Boolean).join(' '),
        )
        setConfirming(null)
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not delete. Try again.')
      }
    })
  }

  const withPayments = confirming?.filter((campaign) => campaign.payments > 0).length ?? 0

  return (
    <div className="space-y-3">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-medium text-on-surface">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={allSelected}
            disabled={!campaigns.length}
            onChange={() => setSelected(allSelected ? [] : campaigns.map((campaign) => campaign.id))}
          />
          Select all
        </label>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => { setError(''); setConfirming(campaigns.filter((campaign) => selected.includes(campaign.id))) }}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
            Delete selected ({selected.length})
          </button>
        )}
      </div>

      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}

      <ul className="divide-y divide-outline-variant/60 overflow-hidden rounded-2xl border border-outline-variant/60">
        {campaigns.length === 0 && (
          <li className="p-4 text-sm text-on-surface-variant">No campaigns yet.</li>
        )}
        {campaigns.map((campaign) => (
          <li key={campaign.id} className={`flex items-center gap-3 px-3 py-3 sm:px-4 ${campaign.active ? '' : 'bg-surface-container-low/60'}`}>
            <input
              type="checkbox"
              aria-label={`Select ${campaign.title}`}
              className="h-4 w-4 shrink-0"
              checked={selected.includes(campaign.id)}
              onChange={() => toggle(campaign.id)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold text-on-surface">{campaign.title}</span>
                {!campaign.active && (
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold uppercase text-on-surface-variant">Inactive</span>
                )}
              </div>
              <p className="truncate text-xs text-on-surface-variant">
                {campaign.categoryName} · {formatDate(campaign.startsAt)}
                {campaign.dueAt ? ` – ${formatDate(campaign.dueAt)}` : ''}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-surface-container-high">
                  <div className="h-full bg-primary" style={{ width: `${campaign.percent}%` }} />
                </div>
                <span className="shrink-0 text-[11px] text-on-surface-variant">
                  KES {campaign.collected.toLocaleString()} / {campaign.target.toLocaleString()} ({campaign.percent}%)
                </span>
              </div>
            </div>
            <Link
              href={`/dashboard/treasurer/campaigns/${campaign.id}`}
              aria-label={`View ${campaign.title}`}
              title="View details"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-primary transition hover:bg-primary/10"
            >
              <span className="material-symbols-outlined text-[20px]">visibility</span>
            </Link>
            <button
              type="button"
              onClick={() => { setError(''); setConfirming([campaign]) }}
              aria-label={`Delete ${campaign.title}`}
              title="Delete"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
          </li>
        ))}
      </ul>

      {confirming && (
        <div
          className="fixed inset-0 z-[140] grid place-items-center bg-[#001f50]/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setConfirming(null) }}
        >
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-campaign-title" className="w-full max-w-md rounded-3xl border border-outline-variant/60 bg-surface p-6 shadow-2xl dark:bg-[#0a1628]">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40">
              <span className="material-symbols-outlined">delete_forever</span>
            </span>
            <h3 id="delete-campaign-title" className="mt-4 font-h3 text-xl text-on-surface">
              {confirming.length === 1 ? `Delete “${confirming[0].title}”?` : `Delete ${confirming.length} campaigns?`}
            </h3>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Member targets for {confirming.length === 1 ? 'this campaign' : 'these campaigns'} will be removed.
              {withPayments > 0 &&
                ` ${withPayments === confirming.length && confirming.length === 1 ? 'It has' : `${withPayments} of them have`} recorded payments and will be kept — deactivate instead.`}
            </p>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(null)} disabled={pending} className="rounded-full border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-60">
                Cancel
              </button>
              <button type="button" onClick={confirmDelete} disabled={pending} className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-60">
                {pending ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
