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

export default function EventsCalendar({ events, hrefFor }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

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
  const cells: Array<{ day: number | null; key: string }> = []
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, key: `pad-${i}` })
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, key: `${year}-${month}-${day}` })
  }

  const label = cursor.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })

  return (
    <div className="rounded-2xl border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-sm"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          Prev
        </button>
        <h3 className="text-sm font-semibold">{label}</h3>
        <button
          type="button"
          className="rounded-lg border px-2 py-1 text-sm"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          Next
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-on-surface-variant">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const dayEvents = c.day ? byDay.get(`${year}-${month}-${c.day}`) || [] : []
          return (
            <div
              key={c.key}
              className={`min-h-16 rounded-lg border p-1 text-left ${c.day ? 'bg-surface-container-low' : 'border-transparent'}`}
            >
              {c.day != null && <div className="text-[11px] font-semibold">{c.day}</div>}
              <ul className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => {
                  const href = hrefFor?.(e.id) || `/events/${e.id}`
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
    </div>
  )
}
