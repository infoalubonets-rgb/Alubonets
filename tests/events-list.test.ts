import { describe, expect, it } from 'vitest'
import { partitionEventsByStart } from '../lib/events-list'

describe('partitionEventsByStart', () => {
  const dinner = { id: 'dinner', title: 'Alubonets Self Help Group Dinner', startsAt: '2026-10-24T16:00:00.000Z' }
  const later = { id: 'later', title: 'Later gathering', startsAt: '2026-11-10T16:00:00.000Z' }
  const older = { id: 'older', title: 'Older meeting', startsAt: '2026-09-01T16:00:00.000Z' }

  it('keeps a 24 Oct event in past after the date, instead of dropping it', () => {
    const { upcoming, past } = partitionEventsByStart([dinner, later, older], new Date('2026-11-01T12:00:00.000Z'))
    expect(upcoming.map((e) => e.id)).toEqual(['later'])
    expect(past.map((e) => e.id)).toEqual(['dinner', 'older'])
  })

  it('lists the same event as upcoming before it starts', () => {
    const { upcoming, past } = partitionEventsByStart([dinner], new Date('2026-10-24T15:59:00.000Z'))
    expect(upcoming.map((e) => e.id)).toEqual(['dinner'])
    expect(past).toEqual([])
  })

  it('does not cap how many past events stay visible', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: `e${i}`,
      startsAt: new Date(Date.UTC(2026, 8, i + 1)).toISOString(),
    }))
    const { past } = partitionEventsByStart(rows, new Date('2026-11-01T00:00:00.000Z'))
    expect(past).toHaveLength(30)
  })
})
