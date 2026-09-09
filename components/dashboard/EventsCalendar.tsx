'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export type CalendarEvent = {
  id: string
  title: string
  startsAt: string | Date
  location?: string | null
}

type Props = {
  events: CalendarEvent[]
  hrefFor?: (id: string) => string
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

export default function EventsCalendar({ events, hrefFor }: Props) {
  const [mode, setMode] = useState<'month' | 'week' | 'list'>('month')
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date()))

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const d = new Date(e.startsAt)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const list = map.get(key) || []
      list.push(e)
      map.set(key, list)
    }
    return map
  }, [events])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthCells: Array<{ day: number | null; key: string }> = []
  for (let i = 0; i < firstDow; i++) monthCells.push({ day: null, key: `pad-${i}` })
  for (let day = 1; day <= daysInMonth; day++) {
    monthCells.push({ day, key: `${year}-${month}-${day}` })
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekCursor)
    d.setDate(weekCursor.getDate() + i)
    return d
  })

  const monthLabel = cursor.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
  const weekLabel = `${weekDays[0].toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const listed = useMemo(
    () => [...events].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [events],
  )

  return (
    <div className="rounded-2xl border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <button
            type="button"
            className={`rounded-lg border px-2 py-1 text-sm ${mode === 'month' ? 'bg-primary text-on-primary' : ''}`}
            onClick={() => setMode('month')}
          >
            Month
          </button>
          <button
            type="button"
            className={`rounded-lg border px-2 py-1 text-sm ${mode === 'week' ? 'bg-primary text-on-primary' : ''}`}
            onClick={() => setMode('week')}
          >
            Week
          </button>
          <button
            type="button"
            className={`rounded-lg border px-2 py-1 text-sm ${mode === 'list' ? 'bg-primary text-on-primary' : ''}`}
            onClick={() => setMode('list')}
          >
            List
          </button>
        </div>
        {mode !== 'list' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-sm"
            onClick={() => {
              if (mode === 'month') setCursor(new Date(year, month - 1, 1))
              else {
                const next = new Date(weekCursor)
                next.setDate(next.getDate() - 7)
                setWeekCursor(next)
              }
            }}
          >
            Prev
          </button>
          <h3 className="text-sm font-semibold">{mode === 'month' ? monthLabel : weekLabel}</h3>
          <button
            type="button"
            className="rounded-lg border px-2 py-1 text-sm"
            onClick={() => {
              if (mode === 'month') setCursor(new Date(year, month + 1, 1))
              else {
                const next = new Date(weekCursor)
                next.setDate(next.getDate() + 7)
                setWeekCursor(next)
              }
            }}
          >
            Next
          </button>
        </div>
        )}
      </div>

      {mode === 'month' ? (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-on-surface-variant">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthCells.map((c) => {
              const dayEvents = c.day ? byDay.get(`${year}-${month}-${c.day}`) || [] : []
              return (
                <div
                  key={c.key}
                  className={`min-h-16 rounded-lg border p-1 text-left ${c.day ? 'bg-surface-container-low' : 'border-transparent'}`}
                >
                  {c.day != null && <div className="text-[11px] font-semibold">{c.day}</div>}
                  <ul className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => {
                      const href = hrefFor?.(e.id) || `/dashboard/organizer/events/${e.id}`
                      return (
                        <li key={e.id}>
                          <Link href={href} className="block truncate rounded bg-primary/10 px-1 text-[10px] text-primary">
                            {e.title}
                          </Link>
                        </li>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <li className="text-[10px] text-on-surface-variant">+{dayEvents.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </>
      ) : mode === 'week' ? (
        <div className="grid gap-2 md:grid-cols-7">
          {weekDays.map((day) => {
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
            const dayEvents = byDay.get(key) || []
            return (
              <div key={key} className="min-h-28 rounded-lg border bg-surface-container-low p-2">
                <p className="text-[11px] font-semibold">
                  {day.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric' })}
                </p>
                <ul className="mt-1 space-y-1">
                  {dayEvents.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={hrefFor?.(e.id) || `/dashboard/organizer/events/${e.id}`}
                        className="block rounded bg-primary/10 px-1.5 py-1 text-[11px] text-primary"
                      >
                        {e.title}
                      </Link>
                    </li>
                  ))}
                  {!dayEvents.length && <li className="text-[10px] text-on-surface-variant">—</li>}
                </ul>
              </div>
            )
          })}
        </div>
      ) : (
        <ul className="divide-y divide-outline-variant">
          {listed.map((e) => {
            const when = new Date(e.startsAt)
            return (
              <li key={e.id} className="flex items-start gap-3 py-2">
                <div className="w-14 shrink-0 text-center">
                  <p className="text-[10px] font-bold uppercase text-secondary">{when.toLocaleDateString('en-KE', { month: 'short' })}</p>
                  <p className="text-lg font-bold text-primary leading-none">{when.getDate()}</p>
                </div>
                <div className="min-w-0">
                  <Link href={hrefFor?.(e.id) || `/dashboard/organizer/events/${e.id}`} className="text-sm font-semibold text-primary hover:underline">
                    {e.title}
                  </Link>
                  <p className="text-[11px] text-on-surface-variant">
                    {when.toLocaleString('en-KE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    {e.location ? ` · ${e.location}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
          {!listed.length && <li className="py-6 text-sm text-on-surface-variant">No events to list.</li>}
        </ul>
      )}
    </div>
  )
}
