import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getSessionProfile } from '@/lib/auth/session'
import { submitEventRsvp } from '@/app/actions/events'
import { getMemberAccess } from '@/lib/auth/member-access'
import MemberGate from '@/components/public/MemberGate'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const event = await prisma.event.findUnique({ where: { id }, select: { title: true, isPublic: true } })
  return { title: event ? `${event.title} — Alubonets` : 'Event' }
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const profile = await getSessionProfile()
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      attachments: true,
      rsvps: profile ? { where: { userId: profile.id }, take: 1 } : false,
      _count: { select: { rsvps: true } },
    },
  })
  if (!event) notFound()

  const access = await getMemberAccess()
  const eventIsPast = new Date(event.startsAt) < new Date()
  if (access.state === 'anonymous' || (!eventIsPast && access.state === 'lapsed')) {
    return (
      <main className="flex-grow">
        <div className="mx-auto max-w-container-max px-md py-xl md:px-lg">
          {access.state === 'anonymous'
            ? <MemberGate variant="login" what="Events" returnTo={`/events/${event.id}`} />
            : <MemberGate variant="renew" what="Upcoming events" reason={access.reason} />}
        </div>
      </main>
    )
  }

  const invited =
    profile &&
    (await prisma.eventInvitation.findFirst({
      where: { eventId: event.id, userId: profile.id },
      select: { id: true },
    }))
  const canView =
    event.isPublic ||
    event.audienceType === 'PUBLIC' ||
    (profile?.status === 'ACTIVE' &&
      (event.audienceType === 'ALL_MEMBERS' ||
        (event.audienceType === 'SELECTED_ROLES' && event.audienceRoles.includes(profile.role)) ||
        Boolean(invited) ||
        Boolean(Array.isArray(event.rsvps) && event.rsvps.length) ||
        profile.role === 'ADMIN' ||
        profile.role === 'ORGANIZER' ||
        profile.role === 'SECRETARY'))
  if (!canView) notFound()

  const date = new Date(event.startsAt)
  const isPast = date < new Date()
  const myRsvp = Array.isArray(event.rsvps) ? event.rsvps[0] : null

  return (
    <main className="flex-grow bg-surface-container-lowest">
      <div className="border-b border-outline-variant/40 bg-surface">
        <div className="mx-auto max-w-container-max px-md py-10 md:px-lg">
          <Link href="/events" className="mb-6 inline-flex items-center gap-2 text-[13px] text-on-surface-variant hover:text-primary">
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_back</span>
            All events
          </Link>
          <h1 className="max-w-3xl text-[30px] font-black leading-tight text-on-surface md:text-[44px]">
            {event.title}
          </h1>
          <p className="mt-3 text-sm text-on-surface-variant">
            {date.toLocaleString()}
            {event.location ? ` · ${event.location}` : ''}
            {isPast ? ' · Past' : ''}
          </p>
          {event.mapsUrl && (
            <a href={event.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary transition hover:opacity-90">
              <span className="material-symbols-outlined text-[18px]">directions</span>Get directions
            </a>
          )}
        </div>
      </div>

      <div className="mx-auto grid max-w-container-max gap-8 px-md py-xl md:grid-cols-3 md:px-lg">
        <div className="space-y-6 md:col-span-2">
          {event.imageUrl && (
            <img src={event.imageUrl} alt="" className="h-64 w-full rounded-2xl object-cover" />
          )}
          <div className="space-y-4">
            {(event.description || '')
              .split('\n')
              .filter(Boolean)
              .map((p, i) => (
                <p key={i} className="text-[16px] leading-relaxed text-on-surface-variant">
                  {p}
                </p>
              ))}
          </div>
          {event.reportPublishedAt && event.reportBody && (
            <section className="rounded-2xl border bg-surface p-5">
              <h2 className="font-h3 text-xl text-primary">Post-event report</h2>
              <p className="mt-2 whitespace-pre-line text-sm">{event.reportBody}</p>
            </section>
          )}
          {event.attachments.length > 0 && (
            <section>
              <h2 className="font-h3 text-lg text-primary">Attachments</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {event.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                      {a.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-surface p-5 shadow-sm">
            <p className="text-sm">{event._count.rsvps} RSVP(s)</p>
            {event.capacity != null && <p className="text-xs text-on-surface-variant">Capacity {event.capacity}</p>}
            {profile?.status === 'ACTIVE' && !isPast ? (
              <form action={submitEventRsvp} className="mt-4 space-y-2">
                <input type="hidden" name="eventId" value={event.id} />
                <select
                  name="status"
                  defaultValue={myRsvp?.status || 'GOING'}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="GOING">Going</option>
                  <option value="MAYBE">Maybe</option>
                  <option value="NOT_GOING">Not going</option>
                </select>
                <input name="note" placeholder="Optional note" className="w-full rounded-lg border px-3 py-2 text-sm" />
                <button className="w-full rounded-full bg-primary py-2 text-sm text-on-primary">Submit RSVP</button>
              </form>
            ) : !profile ? (
              <p className="mt-3 text-sm">
                <Link href="/login" className="text-primary underline">
                  Sign in
                </Link>{' '}
                to RSVP.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  )
}
