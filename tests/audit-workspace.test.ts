import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workspaceCookieValue } from '@/lib/auth/workspace'
const mocks = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn(), cookies: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: mocks.find }, auditLog: { create: mocks.create } } }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
import { writeAudit } from '@/lib/audit'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.find.mockResolvedValue({ id: 'admin', role: 'ADMIN', isSuperAdmin: true, dashboardAccess: [] })
  mocks.cookies.mockResolvedValue({ get: () => ({ value: workspaceCookieValue('admin', 'SECRETARY') }) })
})
describe('audit role actually used', () => {
  it('records a secondary workspace even when the primary role can also perform the action', async () => {
    await writeAudit({ userId: 'admin', action: 'MEETING_CREATE' })
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorRole: 'ADMIN', actingRole: 'SECRETARY', outsideRole: true,
    }) }))
  })
  it('records primary role actions without flagging secondary access', async () => {
    mocks.cookies.mockResolvedValue({ get: () => ({ value: workspaceCookieValue('admin', 'ADMIN') }) })
    await writeAudit({ userId: 'admin', action: 'MEETING_CREATE' })
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorRole: 'ADMIN', actingRole: 'ADMIN', outsideRole: false,
    }) }))
  })
  it('still writes background audit records without request cookies', async () => {
    mocks.cookies.mockRejectedValue(new Error('No request context'))
    await writeAudit({ userId: 'admin', action: 'MEETING_CREATE' })
    expect(mocks.create).toHaveBeenCalledOnce()
  })
})
