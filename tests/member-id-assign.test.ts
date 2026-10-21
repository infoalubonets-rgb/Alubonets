import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() }))

vi.mock('@/lib/prisma', () => {
  const tx = { user: { findUnique: mocks.findUnique, updateMany: mocks.updateMany }, membershipSequence: { upsert: mocks.upsert } }
  return { prisma: { user: { findMany: mocks.findMany }, $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } }
})

import { assignMissingMembershipNumbers, ensureMembershipNumber } from '@/lib/member-id-assign'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.upsert.mockResolvedValue({ lastValue: 8 })
  mocks.findUnique.mockResolvedValue({ membershipNumber: null })
})

describe('member ID assignment', () => {
  it('keeps an existing ID', async () => {
    expect(await ensureMembershipNumber({ id: 'u', membershipNumber: 'AL2608-001', status: 'ACTIVE' })).toBe('AL2608-001')
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('gives an approved account without an ID the next one, only where none is set', async () => {
    const id = await ensureMembershipNumber({ id: 'u', membershipNumber: null, status: 'ACTIVE' }, )
    expect(id).toMatch(/^AL\d{6}-008$/)
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { year: 0 } }))
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: 'u', membershipNumber: null }, data: { membershipNumber: id } })
  })

  it('skips pending applicants and deleted members', async () => {
    expect(await ensureMembershipNumber({ id: 'u', membershipNumber: null, status: 'PENDING' })).toBeNull()
    expect(await ensureMembershipNumber({ id: 'u', membershipNumber: null, status: 'INACTIVE', email: 'deleted-u@deleted.invalid' })).toBeNull()
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('fills every approved account that is missing an ID', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    expect(await assignMissingMembershipNumbers()).toBe(2)
    expect(mocks.findMany.mock.calls[0][0].where).toMatchObject({ membershipNumber: null, status: { not: 'PENDING' } })
  })
})
