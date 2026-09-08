import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublicEvents } from '@/lib/data/queries'

export const metadata: Metadata = {
  title: 'Events — Alubonets SHG',
  description: 'Upcoming and past events organised by Alubonets Self-Help Group.',
}

type EventRow = {
  id: string
  title: string
  description?: string | null
  location?: string | null
  mapsUrl?: string | null
  startsAt: string
  imageUrl?: string | null
}

function EventCard({ event, past = false }: { event: EventRow; past?: boolean }) {
  const date = new Date(event.startsAt)
  const month = date.toLocaleDateString('en-KE', { month: 'short' }).toUpperCase()
  const day = date.getDate()
  const weekday = date.toLocaleDateString('en-KE', { weekday: 'long' })
  const time = date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  const fullDate = date.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Link href={`/events/${event.id}`} className="block group">
      <article className={`rounded-2xl border border-outline-variant bg-surface overflow-hidden flex flex-col shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 h-full ${past ? 'opacity-60' : ''}`}>

        {event.imageUrl ? (
          <div className="relative overflow-hidden">
            <img
              src={event.imageUrl}
              alt={event.title}
              className={`w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105 ${past ? 'grayscale' : ''}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div className="absolute bottom-3 left-3">
              <div className="flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 shadow">
                <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest leading-none">{month}</span>
                <span className="text-[19px] font-black text-white leading-none">{day}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative h-36 bg-gradient-to-br from-primary to-[#001435] overflow-hidden">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[100px] font-black leading-none select-none text-white/[0.055] pointer-events-none">{day}</span>
            <div className="absolute inset-0 flex items-center px-5 gap-4">
              <div className="flex flex-col items-center justify-center w-14 h-14 flex-shrink-0 rounded-2xl bg-white/12 backdrop-blur-sm border border-white/15">
                <span className="text-[9px] font-bold text-on-primary/70 uppercase tracking-[0.18em] leading-none">{month}</span>
                <span className="text-[28px] font-black text-on-primary leading-none">{day}</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-[16px] font-bold text-on-primary leading-snug line-clamp-2">{event.title}</h3>
                {!past && (
                  <p className="text-[12px] text-on-primary/60 mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>schedule</span>
                    {weekday}, {time}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="p-4 flex flex-col gap-2 flex-1">
          {event.imageUrl && (
            <h3 className={`font-bold text-[15px] leading-snug line-clamp-2 ${past ? 'text-on-surface-variant' : 'text-on-surface'}`}>
              {event.title}
            </h3>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[13px] text-on-surface-variant">
              <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 15 }}>schedule</span>
              <span>{past ? fullDate : `${weekday}, ${time}`}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-[13px] text-on-surface-variant">
                <span className="material-symbols-outlined text-secondary-container flex-shrink-0" style={{ fontSize: 15 }}>location_on</span>
                <span className="truncate">{event.location}</span>
              </div>
            )}
            {event.mapsUrl && <a href={event.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"><span className="material-symbols-outlined text-[15px]">directions</span>Get directions</a>}
          </div>

          {event.description && !past && (
            <p className="text-[13px] text-on-surface-variant/80 leading-relaxed line-clamp-2 pt-2.5 border-t border-outline-variant/40">
              {event.description}
            </p>
          )}

          <div className="mt-auto pt-3">
            {past ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-outline font-medium">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>event_busy</span>
                Past event
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary group-hover:gap-2.5 transition-all">
                Learn more
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}

export default async function PublicEventsPage() {
  const { upcoming, past } = await getPublicEvents()

  return (
    <main className="flex-grow">
      <div className="max-w-container-max mx-auto px-md md:px-lg py-xl space-y-xxl">

        <section>
          <div className="reveal mb-lg flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 20 }}>event_upcoming</span>
            </div>
            <div>
              <h2 className="font-h3 text-[20px] leading-none text-on-surface">Upcoming events</h2>
              <p className="mt-0.5 text-[12px] text-on-surface-variant">{upcoming.length} event{upcoming.length !== 1 ? 's' : ''} scheduled</p>
            </div>
          </div>

          {upcoming.length === 0 ? (
            <div className="reveal rounded-2xl border border-outline-variant bg-surface-container-low p-xl text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8">
                <span className="material-symbols-outlined icon-fill text-primary/50" style={{ fontSize: 32 }}>calendar_month</span>
              </div>
              <p className="font-semibold text-on-surface">No upcoming events at the moment.</p>
              <p className="mt-1 text-[13px] text-on-surface-variant">Check back soon — events are added regularly.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((e, index) => (
                <div key={e.id} className="reveal" style={{ ['--reveal-delay' as string]: `${index * 80}ms` }}>
                  <EventCard event={e} />
                </div>
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section>
            <div className="reveal mb-lg flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container">
                <span className="material-symbols-outlined text-outline" style={{ fontSize: 20 }}>history</span>
              </div>
              <div>
                <h2 className="font-h3 text-[18px] leading-none text-on-surface-variant">Recent past events</h2>
                <p className="mt-0.5 text-[12px] text-outline">{past.length} past event{past.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
              {past.map((e, index) => (
                <div key={e.id} className="reveal" style={{ ['--reveal-delay' as string]: `${index * 70}ms` }}>
                  <EventCard event={e} past />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
