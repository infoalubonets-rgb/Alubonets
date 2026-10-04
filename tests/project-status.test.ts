import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const { deriveProjectStatus, fundingProgress } = await import('../lib/project-status')

const now = new Date('2026-10-03T09:00:00.000Z')
const day = (value: string) => new Date(`${value}T00:00:00.000Z`)

describe('project status from dates', () => {
  it('keeps the manual status when no dates are set', () => {
    expect(deriveProjectStatus(null, null, now)).toBeNull()
  })

  it('is upcoming before the start date', () => {
    expect(deriveProjectStatus(day('2026-10-10'), day('2026-12-01'), now)).toBe('UPCOMING')
  })

  it('is ongoing from the start date until the end date', () => {
    expect(deriveProjectStatus(day('2026-10-03'), day('2026-10-03'), now)).toBe('ONGOING')
    expect(deriveProjectStatus(day('2026-09-01'), null, now)).toBe('ONGOING')
  })

  it('is completed after the end date', () => {
    expect(deriveProjectStatus(day('2026-01-01'), day('2026-10-02'), now)).toBe('COMPLETED')
  })

  it('caps funding progress between 0 and 100', () => {
    expect(fundingProgress(50, 200)).toBe(25)
    expect(fundingProgress(500, 200)).toBe(100)
    expect(fundingProgress(10, 0)).toBeNull()
  })
})
