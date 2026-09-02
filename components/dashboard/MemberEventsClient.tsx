'use client'

import { useState, useTransition } from 'react'
import { deleteEventFromMemberView, submitEventRsvp } from '@/app/actions/events'

type Rsvp = { status: string } | undefined

export type MemberEventCard = {
  id: string
  title: string
  description?: string | null
  location?: string | null
  mapsUrl?: string | null
  startsAt: string
  endsAt?: string | null
  imageUrl?: string | null
  isPublic?: boolean
  capacity?: number | null
  rsvpCount: number
  myRsvp?: Rsvp
  reportPublishedAt?: string | null
  canDelete?: boolean
}

export default function MemberEventsClient({ upcoming, past }: { upcoming: MemberEventCard[]; past: MemberEventCard[] }) {
  const [detail, setDetail] = useState<MemberEventCard | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [deleting, startDelete] = useTransition()
  const visibleUpcoming = upcoming.filter((event) => !deletedIds.has(event.id))
  const visiblePast = past.filter((event) => !deletedIds.has(event.id))
  const events = [
    ...visibleUpcoming.map((event) => ({ event, past: false })),
    ...visiblePast.map((event) => ({ event, past: true })),
  ].sort((a, b) => Math.abs(new Date(a.event.startsAt).getTime() - Date.now()) - Math.abs(new Date(b.event.startsAt).getTime() - Date.now()))

  function removeEvent(event: MemberEventCard) {
    if (!window.confirm(`Delete “${event.title}”? This cannot be undone.`)) return
    startDelete(async () => {
      await deleteEventFromMemberView(event.id)
      setDeletedIds((current) => new Set(current).add(event.id))
      setDetail(null)
    })
  }

  return (
    <div>
      {events.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {events.map(({ event, past: isPast }) => (
            <EventCard key={event.id} event={event} past={isPast} onView={() => setDetail(event)} onDelete={() => removeEvent(event)} deleting={deleting} />
          ))}
        </div>
      )}

      {detail && <EventDetailsModal event={detail} onClose={() => setDetail(null)} onDelete={removeEvent} deleting={deleting} />}
    </div>
  )
}

function EventCard({ event, past, onView, onDelete, deleting }: {
  event: MemberEventCard
  past: boolean
  onView: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const startsAt = new Date(event.startsAt)
  return (
    <article className={`group relative flex min-h-[230px] flex-col overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${past ? 'border-outline-variant bg-surface opacity-60 dark:bg-[#0a1628]' : 'border-outline-variant bg-surface hover:border-primary/35 dark:bg-[#0a1628]'}`}>
      {!event.isPublic && (
        <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
          <span className="material-symbols-outlined text-[12px]">lock</span>
          Members only
        </span>
      )}
      {event.imageUrl ? (
        <div className="relative overflow-hidden"><img src={event.imageUrl} alt="" className={`h-36 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${past ? 'grayscale' : ''}`} /><div className="absolute inset-0 bg-gradient-to-t from-primary/70 to-transparent" /></div>
      ) : (
        <div className={`relative h-28 overflow-hidden bg-gradient-to-br from-primary to-[#001435] ${past ? 'opacity-80' : ''}`}>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 select-none text-[88px] font-black leading-none text-white/[0.06]">{startsAt.getDate()}</span>
          <div className="absolute inset-0 flex items-center gap-3 px-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 text-center"><span className="text-[9px] font-bold uppercase tracking-widest text-white/70">{startsAt.toLocaleDateString('en-KE', { month: 'short' })}</span><span className="-mt-3 text-[25px] font-black text-white">{startsAt.getDate()}</span></div><p className="line-clamp-2 text-[15px] font-bold text-white">{event.title}</p></div>
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-secondary-container">{startsAt.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <h3 className="mt-1 line-clamp-2 text-[15px] font-bold leading-snug text-on-surface dark:text-blue-50">{event.title}</h3>
          </div>
          <button type="button" onClick={onView} aria-label={`View details for ${event.title}`} title="View details" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition hover:bg-primary hover:text-on-primary">
            <span className="material-symbols-outlined text-[19px]">visibility</span>
          </button>
        </div>
        <div className="mt-3 space-y-1.5 text-[12px] text-on-surface-variant">
          <p className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[15px] text-primary">schedule</span>{startsAt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</p>
          {event.location && <p className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[15px] text-secondary-container">location_on</span><span className="truncate">{event.location}</span></p>}
          {event.mapsUrl && <a href={event.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-primary hover:underline"><span className="material-symbols-outlined text-[15px]">directions</span>Get directions</a>}
          <p>{event.rsvpCount} RSVP{event.rsvpCount === 1 ? '' : 's'}{event.myRsvp ? ` · You: ${event.myRsvp.status.replace('_', ' ').toLowerCase()}` : ''}</p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          {!past ? <RsvpForm event={event} /> : <span className="text-[11px] text-on-surface-variant">{event.reportPublishedAt ? 'Report published' : 'Event ended'}</span>}
          {event.canDelete && <button type="button" disabled={deleting} onClick={onDelete} aria-label={`Delete ${event.title}`} title="Delete event" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-outline transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><span className="material-symbols-outlined text-[18px]">delete</span></button>}
        </div>
      </div>
    </article>
  )
}

function RsvpForm({ event }: { event: MemberEventCard }) {
  const [status, setStatus] = useState(event.myRsvp?.status || 'GOING')
  const [message, setMessage] = useState('')
  const [saving, startSaving] = useTransition()

  function saveRsvp(formData: FormData) {
    setMessage('')
    startSaving(async () => {
      try {
        await submitEventRsvp(formData)
        setMessage('Saved')
      } catch {
        setMessage('Could not save')
      }
    })
  }

  return (
    <form action={saveRsvp} className="flex min-w-0 flex-wrap items-center gap-1.5">
      <input type="hidden" name="eventId" value={event.id} />
      <select name="status" aria-label={`RSVP for ${event.title}`} value={status} onChange={(e) => { setStatus(e.target.value); setMessage('') }} className="min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-[11px]">
        <option value="GOING">Going</option><option value="MAYBE">Maybe</option><option value="NOT_GOING">Not going</option>
      </select>
      <button disabled={saving} className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-on-primary disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
      {message && <span role="status" className={`text-[10px] font-bold ${message === 'Saved' ? 'text-green-700' : 'text-red-600'}`}>{message}</span>}
    </form>
  )
}

function EventDetailsModal({ event, onClose, onDelete, deleting }: { event: MemberEventCard; onClose: () => void; onDelete: (event: MemberEventCard) => void; deleting: boolean }) {
  const startsAt = new Date(event.startsAt)
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="event-detail-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()} className="fixed inset-0 z-[100] grid place-items-center bg-[#001f50]/55 p-3 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-3xl overflow-hidden rounded-3xl border border-outline-variant bg-surface shadow-2xl dark:bg-[#0a1628]">
        {event.imageUrl && <img src={event.imageUrl} alt="" className="h-52 w-full rounded-t-3xl object-cover sm:h-64 lg:h-72" />}
        <div className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-bold uppercase tracking-wide text-secondary-container">Event details</p><h2 id="event-detail-title" className="mt-0.5 !text-[21px] font-bold leading-tight text-primary dark:text-primary-fixed-dim">{event.title}</h2></div>
            <button type="button" onClick={onClose} aria-label="Close event details" className="grid h-8 w-8 place-items-center rounded-full bg-surface-container text-on-surface-variant"><span className="material-symbols-outlined text-[19px]">close</span></button>
          </div>
          <div className="mt-3 grid gap-2 rounded-2xl bg-surface-container-low p-3 text-[12px] sm:grid-cols-2">
            <p><b className="block text-[10px] text-on-surface-variant">Starts</b>{startsAt.toLocaleString('en-KE')}</p>
            {event.endsAt && <p><b className="block text-[10px] text-on-surface-variant">Ends</b>{new Date(event.endsAt).toLocaleString('en-KE')}</p>}
            <p><b className="block text-[10px] text-on-surface-variant">Location</b>{event.location || 'Not specified'}{event.mapsUrl && <a href={event.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex w-fit items-center gap-1 font-bold text-primary hover:underline"><span className="material-symbols-outlined text-[14px]">directions</span>Get directions</a>}</p>
            <p><b className="block text-[10px] text-on-surface-variant">Attendance</b>{event.rsvpCount}{event.capacity ? ` of ${event.capacity}` : ''} RSVP responses</p>
          </div>
          <div className="mt-3"><h3 className="text-[13px] font-bold text-on-surface">About this event</h3><p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-on-surface-variant">{event.description || 'No additional description was provided.'}</p></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-3">
            {startsAt >= new Date() ? <RsvpForm event={event} /> : <span className="text-[12px] text-on-surface-variant">This event has ended.</span>}
            {event.canDelete && <button type="button" disabled={deleting} onClick={() => onDelete(event)} className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-[12px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"><span className="material-symbols-outlined text-[16px]">delete</span>Delete event</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
