import { describe, expect, it } from 'vitest'
import { rangeFilter, resolveTimeRange } from '../lib/time-range'

// 11 Oct 2026 16:00 in Nairobi (UTC+3).
const now = new Date('2026-10-11T13:00:00Z')

describe('resolveTimeRange', () => {
  it('last 24 hours is exact to the hour', () => {
    const r = resolveTimeRange({ range: '24h' }, now)
    expect(r.gte?.toISOString()).toBe('2026-10-10T13:00:00.000Z')
    expect(r.lte?.toISOString()).toBe('2026-10-11T13:00:00.000Z')
  })

  it('last 7 days covers today and the six days before, in Nairobi time', () => {
    const r = resolveTimeRange({ range: '7' }, now)
    expect([r.from, r.to]).toEqual(['2026-10-05', '2026-10-11'])
    expect(r.gte?.toISOString()).toBe('2026-10-04T21:00:00.000Z')
    expect(r.lte?.toISOString()).toBe('2026-10-11T20:59:59.999Z')
  })

  it('last 30 days and this week', () => {
    expect(resolveTimeRange({ range: '30' }, now).from).toBe('2026-09-12')
    // 11 Oct 2026 is a Sunday, so the week started Monday 5 Oct.
    expect(resolveTimeRange({ range: 'week' }, now).from).toBe('2026-10-05')
  })

  it('custom dates are whole days and get swapped when reversed', () => {
    const r = resolveTimeRange({ range: 'custom', from: '2026-11-07', to: '2026-10-21' }, now)
    expect([r.from, r.to]).toEqual(['2026-10-21', '2026-11-07'])
    expect(r.key).toBe('custom')
  })

  it('dates without a preset count as custom; nothing means all time', () => {
    expect(resolveTimeRange({ from: '2026-10-01' }, now).key).toBe('custom')
    const all = resolveTimeRange({}, now)
    expect(all.key).toBe('all')
    expect(rangeFilter(all)).toBeUndefined()
  })
})
