'use client'

import { useState } from 'react'
import Link from 'next/link'
import EventsCalendar from '@/components/dashboard/EventsCalendar'
import { submitEventRsvp } from '@/app/actions/events'

type Rsvp = { status: string } | undefined

export type MemberEventCard = {
  id: string
  title: string
  startsAt: string
  rsvpCount: number
  myRsvp?: Rsvp
  reportPublishedAt?: string | null
}

export default function MemberEventsClient({
  upcoming,
  past,
}: {
  upcoming: MemberEventCard[]
  past: MemberEventCard[]
}) {
  const [view, setView] = useState<'list' | 'calendar'>('list')

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex overflow-hidden rounded-xl border text-[12px]">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`px-3 py-2 ${view === 'list' ? 'bg-primary text-on-primary' : 'bg-surface'}`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView('calendar')}
            className={`px-3 py-2 ${view === 'calendar' ? 'bg-primary text-on-primary' : 'bg-surface'}`}
          >
            Calendar
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        <EventsCalendar events={[...upcoming, ...past]} hrefFor={(id) => `/events/${id}`} />
      ) : (
        <>
          <section>
            <h2 className="font-h3 text-xl text-primary">Upcoming</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {upcoming.map((event) => (
                <article key={event.id} className="rounded-2xl border bg-surface p-4">
                  <b>{event.title}</b>
                  <p className="text-sm">{new Date(event.startsAt).toLocaleString()}</p>
                  <p className="text-xs text-on-surface-variant">
                    {event.rsvpCount} RSVPs
                    {event.myRsvp ? ` · your reply: ${event.myRsvp.status}` : ''}
                  </p>
                  <form action={submitEventRsvp} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="eventId" value={event.id} />
                    <select
                      name="status"
                      defaultValue={event.myRsvp?.status || 'GOING'}
                      className="rounded-lg border px-2 py-1 text-sm"
                    >
                      <option value="GOING">Going</option>
                      <option value="MAYBE">Maybe</option>
                      <option value="NOT_GOING">Not going</option>
                    </select>
                    <button className="text-sm text-primary underline">RSVP</button>
                  </form>
                  <Link href={`/events/${event.id}`} className="mt-2 inline-block text-sm text-primary underline">
                    Open details
                  </Link>
                </article>
              ))}
              {!upcoming.length && <p className="text-sm">No upcoming events.</p>}
            </div>
          </section>

          <section>
            <h2 className="font-h3 text-xl text-primary">Past</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {past.map((event) => (
                <li key={event.id} className="rounded-xl border bg-surface px-4 py-3">
                  <Link href={`/events/${event.id}`} className="text-primary underline">
                    {event.title}
                  </Link>{' '}
                  · {new Date(event.startsAt).toLocaleDateString()}
                  {event.reportPublishedAt ? ' · report published' : ''}
                </li>
              ))}
              {!past.length && <p className="text-sm">No past events.</p>}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
