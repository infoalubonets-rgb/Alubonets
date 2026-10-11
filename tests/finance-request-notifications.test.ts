import { describe, it, expect, vi } from 'vitest'
const { findMany, createMany } = vi.hoisted(() => ({ findMany: vi.fn(), createMany: vi.fn() }))
vi.mock('../lib/prisma', () => ({ prisma: { user: { findMany }, userNotification: { createMany } } }))
import { notifyTreasurerRequest } from '../lib/notifications'
describe('request notification routing', () => {
  it('selects only active primary Treasurer accounts and tags their workspace', async () => {
    findMany.mockResolvedValue([{ id: 'treasurer' }])
    await notifyTreasurerRequest({ title: 'Request', type: 'loan', entity: 'LoanApplication', entityId: 'loan' })
    expect(findMany).toHaveBeenCalledWith({ where: { role: 'TREASURER', status: 'ACTIVE' }, select: { id: true } })
    expect(createMany.mock.calls[0][0].data[0]).toMatchObject({ userId: 'treasurer', type: 'finance_request', audienceRoles: ['TREASURER'] })
  })
})
