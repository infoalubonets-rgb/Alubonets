import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const tasks = vi.hoisted(() => ({
  order: [] as string[],
  expired: vi.fn(), overdue: vi.fn(), reminders: vi.fn(), scheduled: vi.fn(), retries: vi.fn(), standing: vi.fn(), projects: vi.fn(),
}))
vi.mock('@/lib/documents', () => ({ syncExpiredDocuments: tasks.expired, syncOverdueActionPoints: tasks.overdue }))
vi.mock('@/app/actions/announcements', () => ({ processEventReminders: tasks.reminders, processScheduledAnnouncements: tasks.scheduled, retryFailedAnnouncementEmailsBatch: tasks.retries }))
vi.mock('@/lib/membership-standing-sync', () => ({ syncMembershipStanding: tasks.standing }))
vi.mock('@/lib/project-status', () => ({ syncProjectStatuses: tasks.projects }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/data/queries', () => ({ TAGS: { projects: 'projects' } }))

import { GET } from '@/app/api/cron/stage4-maintenance/route'

function request(secret = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/stage4-maintenance', { headers: { authorization: `Bearer ${secret}` } })
}

describe('stage4 maintenance cron', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('CRON_SECRET', 'test-secret')
    tasks.order.length = 0
    for (const [name, fn] of Object.entries({ expired: tasks.expired, overdue: tasks.overdue, reminders: tasks.reminders, scheduled: tasks.scheduled, retries: tasks.retries, standing: tasks.standing, projects: tasks.projects })) {
      fn.mockImplementation(async () => { tasks.order.push(name); return name === 'projects' ? { checked: 0, updated: 0 } : 0 })
    }
  })

  it('runs each sweep in order without a database burst', async () => {
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(tasks.order).toEqual(['expired', 'overdue', 'reminders', 'scheduled', 'retries', 'standing', 'projects'])
  })

  it('reports the failed task while still running subsequent sweeps', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    tasks.reminders.mockImplementation(async () => { tasks.order.push('reminders'); throw new Error('broken reminder') })
    const response = await GET(request())
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.failures).toEqual(['eventReminders'])
    expect(body.eventReminders).toEqual({ error: 'Task failed' })
    expect(tasks.order).toContain('projects')
    expect(JSON.stringify(body)).not.toContain('broken reminder')
    vi.restoreAllMocks()
  })

  it('rejects an invalid cron secret before doing work', async () => {
    const response = await GET(request('wrong-secret'))
    expect(response.status).toBe(401)
    expect(tasks.expired).not.toHaveBeenCalled()
  })
})
