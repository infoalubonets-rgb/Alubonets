import { describe, expect, it } from 'vitest'
import { paymentsCountFrom, unseenAlertCount } from '../lib/notification-seen'

describe('bell count after "Mark all as read"', () => {
  const alerts = [
    { key: 'admin-approvals', count: 3 },
    { key: 'admin-gallery', count: 1 },
  ]

  it('counts every to-do when nothing was marked read', () => {
    expect(unseenAlertCount(alerts, { alerts: {}, paymentsSeenAt: null })).toBe(4)
  })

  it('counts only to-dos added since they were marked read', () => {
    expect(unseenAlertCount(alerts, { alerts: { 'admin-approvals': 3, 'admin-gallery': 1 }, paymentsSeenAt: null })).toBe(0)
    expect(unseenAlertCount(alerts, { alerts: { 'admin-approvals': 2, 'admin-gallery': 1 }, paymentsSeenAt: null })).toBe(1)
  })

  it('never goes negative when to-dos were cleared', () => {
    expect(unseenAlertCount([{ key: 'admin-approvals', count: 0 }], { alerts: { 'admin-approvals': 5 }, paymentsSeenAt: null })).toBe(0)
  })

  it('counts payments from the later of 24 hours ago or last marked read', () => {
    const now = new Date('2026-10-05T12:00:00Z')
    expect(paymentsCountFrom({ alerts: {}, paymentsSeenAt: null }, now).toISOString()).toBe('2026-10-04T12:00:00.000Z')
    expect(paymentsCountFrom({ alerts: {}, paymentsSeenAt: '2026-10-05T10:00:00Z' }, now).toISOString()).toBe('2026-10-05T10:00:00.000Z')
    expect(paymentsCountFrom({ alerts: {}, paymentsSeenAt: '2026-10-01T10:00:00Z' }, now).toISOString()).toBe('2026-10-04T12:00:00.000Z')
  })
})
