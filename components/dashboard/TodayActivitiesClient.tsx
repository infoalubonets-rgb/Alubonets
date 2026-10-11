'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { todayInputValue } from '@/lib/dates'

type Activity = {
  id: string
  title: string
  subtitle: string | null
  body: string | null
  imageUrl: string | null
  startsAt: string
  venue: string | null
  emailed: boolean
  canDelete: boolean
  createdByName: string
}

function dayLabel(iso: string, style: 'short' | 'long' = 'short') {
  return new Date(iso).toLocaleDateString('en-KE', style === 'long'
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function TodayActivitiesClient({
  activities,
  deleteAction,
}: {
  activities: Activity[]
  deleteAction: (formData: FormData) => Promise<void>
}) {
  const router = useRouter()
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Activity | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const viewing = activities.find((activity) => activity.id === viewingId) ?? null
  const todayKey = todayInputValue()
  const isToday = (activity: Activity) => new Date(activity.startsAt).toLocaleDateString('en-CA') <= todayKey

  async function confirmDelete() {
    if (!deleting || pending) return
    setPending(true)
    setError('')
    try {
      const formData = new FormData()
      formData.set('id', deleting.id)
      await deleteAction(formData)
      setDeleting(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_4px_12px_rgba(20,32,51,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low text-left">
                {['Date', 'Activity', 'Posted by'].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">{heading}</th>
                ))}
                <th className="w-28 px-4 py-3 text-right font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-on-surface-variant">No activities today or coming up.</td>
                </tr>
              ) : (
                activities.map((activity, i) => (
                  <tr key={activity.id} className={`border-t border-outline-variant/50 transition-colors hover:bg-primary/[0.03] ${i % 2 === 1 ? 'bg-surface-container-low/40' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">
                      {dayLabel(activity.startsAt)}
                      {isToday(activity) && <span className="ml-2 rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold text-on-primary">Today</span>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1.5 font-medium text-on-surface">
                        {activity.title}
                        {activity.imageUrl && <span className="material-symbols-outlined text-[15px] text-on-surface-variant" title="Has image">image</span>}
                        {activity.emailed && <span className="material-symbols-outlined text-[15px] text-primary" title="Members were emailed">mail</span>}
                      </p>
                      {activity.subtitle && <p className="text-xs text-on-surface-variant">{activity.subtitle}</p>}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{activity.createdByName}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex gap-1">
                        <button type="button" onClick={() => setViewingId(activity.id)} title="View details" aria-label={`View ${activity.title}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition hover:bg-primary/10">
                          <span className="material-symbols-outlined text-[19px]">visibility</span>
                        </button>
                        {activity.canDelete && (
                          <button type="button" onClick={() => { setError(''); setDeleting(activity) }} title="Delete" aria-label={`Delete ${activity.title}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-error transition hover:bg-error-container/40">
                            <span className="material-symbols-outlined text-[19px]">delete</span>
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <FullScreenModal open={Boolean(viewing)} title={viewing?.title ?? 'Activity'} onClose={() => setViewingId(null)} size="compact">
        {viewing && (
          <div className="space-y-3">
            {viewing.imageUrl && (
              <img src={viewing.imageUrl} alt="" className="max-h-72 w-full rounded-xl object-cover" />
            )}
            <p className="text-sm font-semibold text-secondary">{dayLabel(viewing.startsAt, 'long')}{viewing.venue ? ` · ${viewing.venue}` : ''}</p>
            {viewing.subtitle && <p className="font-medium text-on-surface">{viewing.subtitle}</p>}
            {viewing.body ? (
              <p className="whitespace-pre-line text-sm text-on-surface-variant">{viewing.body}</p>
            ) : (
              <p className="text-sm text-on-surface-variant">No description.</p>
            )}
            <p className="border-t border-outline-variant pt-3 text-xs text-on-surface-variant">
              Posted by {viewing.createdByName}{viewing.emailed ? ' · Members were emailed' : ' · In-app notification only'}
            </p>
          </div>
        )}
      </FullScreenModal>

      <FullScreenModal open={Boolean(deleting)} title="Delete activity?" onClose={() => !pending && setDeleting(null)} size="compact">
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            Delete <b className="text-on-surface">{deleting?.title}</b>? It disappears for everyone, and its notifications are removed from members’ Notifications.
            {deleting?.emailed ? ' Emails already sent cannot be recalled.' : ''}
          </p>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={pending} onClick={() => setDeleting(null)} className="rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button>
            <button type="button" disabled={pending} onClick={confirmDelete} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {pending ? 'Deleting…' : 'Yes, delete'}
            </button>
          </div>
        </div>
      </FullScreenModal>
    </div>
  )
}
