import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findUnique: vi.fn(),
  contributionFindMany: vi.fn(),
  reverseContributions: vi.fn(),
  userDelete: vi.fn(),
  userUpdate: vi.fn(),
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
  writeAudit: vi.fn(),
  deleteAuthUser: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({ requireAdmin: mocks.requireAdmin, requireActiveRole: vi.fn(), syncUserMetadata: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const many = { deleteMany: mocks.deleteMany, updateMany: mocks.updateMany }
  const tx = {
    supportingDocument: many, supportMessage: many, familyAccountTransition: many, familyBranchHistory: many,
    memberProfile: many, userNotification: many, passwordResetToken: many, consentRecord: many,
    profileVisibility: many, familyInvite: many, supportConversation: many, loginEvent: many,
    user: { delete: mocks.userDelete, update: mocks.userUpdate },
  }
  return {
    prisma: {
      user: { findUnique: mocks.findUnique },
      contribution: { findMany: mocks.contributionFindMany },
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  }
})
vi.mock('@/lib/contribution-deletion', () => ({ reverseContributions: mocks.reverseContributions }))
vi.mock('@/lib/audit', () => ({ writeAudit: mocks.writeAudit }))
vi.mock('@/lib/supabase-server', () => ({ createServerClient: () => ({ auth: { admin: { deleteUser: mocks.deleteAuthUser } } }) }))
vi.mock('@/lib/email/resend', () => ({ sendMemberApprovedEmail: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('next/server', () => ({ after: vi.fn() }))

import { deleteMember, deleteMembers } from '@/app/actions/members'

const member = (extra: Record<string, unknown> = {}, attachedMembers = 0) => ({
  id: 'm1', fullName: 'Jane Member', email: 'jane@example.com', role: 'MEMBER', status: 'RESIGNED', isSuperAdmin: false,
  authUserId: 'auth-1', membershipNumber: 'AL-1', _count: { attachedMembers }, ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAdmin.mockResolvedValue({ id: 'admin', role: 'ADMIN', isSuperAdmin: true })
  mocks.deleteAuthUser.mockResolvedValue({ error: null })
  mocks.contributionFindMany.mockResolvedValue([])
  mocks.reverseContributions.mockImplementation(async (_actor: string, ids: string[]) => ids.length)
})

describe('deleting a member', () => {
  it('deletes their contributions, then the member and their sign-in, and audits it', async () => {
    mocks.findUnique.mockResolvedValue(member())
    mocks.contributionFindMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }])
    expect(await deleteMember({ userId: 'm1' })).toEqual({ ok: true })
    expect(mocks.reverseContributions).toHaveBeenCalledWith('admin', ['c1', 'c2'], 'Member Jane Member deleted')
    expect(mocks.userDelete).toHaveBeenCalledWith({ where: { id: 'm1' } })
    expect(mocks.userUpdate).not.toHaveBeenCalled()
    expect(mocks.writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'MEMBER_DELETE', entityId: 'm1', meta: expect.objectContaining({ mode: 'deleted', deletedPayments: 2 }) }))
    expect(mocks.deleteAuthUser).toHaveBeenCalledWith('auth-1')
  })

  it('wipes the account instead when locked ledger records still point at it', async () => {
    mocks.findUnique.mockResolvedValue(member())
    mocks.userDelete.mockRejectedValue(Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' }))
    expect(await deleteMember({ userId: 'm1' })).toEqual({ ok: true })
    const data = mocks.userUpdate.mock.calls[0][0].data
    expect(data).toMatchObject({ fullName: 'Deleted member', email: 'deleted-m1@deleted.invalid', authUserId: null, phone: null, status: 'INACTIVE', role: 'MEMBER' })
    expect(mocks.writeAudit).toHaveBeenCalledWith(expect.objectContaining({ meta: expect.objectContaining({ mode: 'wiped' }) }))
    expect(mocks.deleteAuthUser).toHaveBeenCalledWith('auth-1')
  })

  it('refuses self, Super Admins and principals with attached members', async () => {
    mocks.findUnique.mockResolvedValueOnce(member({ id: 'admin' }))
    expect(await deleteMember({ userId: 'admin' })).toMatchObject({ ok: false })
    mocks.findUnique.mockResolvedValueOnce(member({ isSuperAdmin: true }))
    expect(await deleteMember({ userId: 'm1' })).toMatchObject({ ok: false })
    mocks.findUnique.mockResolvedValueOnce(member({}, 2))
    expect(await deleteMember({ userId: 'm1' })).toMatchObject({ ok: false, error: expect.stringContaining('attached') })
    expect(mocks.userDelete).not.toHaveBeenCalled()
    expect(mocks.reverseContributions).not.toHaveBeenCalled()
  })

  it('a plain Admin cannot delete Admins or members with payments', async () => {
    mocks.requireAdmin.mockResolvedValue({ id: 'admin', role: 'ADMIN', isSuperAdmin: false })
    mocks.findUnique.mockResolvedValueOnce(member({ role: 'ADMIN' }))
    expect(await deleteMember({ userId: 'm1' })).toMatchObject({ ok: false, error: expect.stringContaining('Super Admin') })
    mocks.findUnique.mockResolvedValueOnce(member())
    mocks.contributionFindMany.mockResolvedValueOnce([{ id: 'c1' }])
    expect(await deleteMember({ userId: 'm1' })).toMatchObject({ ok: false, error: expect.stringContaining('payments') })
    expect(mocks.reverseContributions).not.toHaveBeenCalled()
  })

  it('bulk deletes and lists the members that could not be deleted', async () => {
    mocks.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === 'boss' ? member({ id: 'boss', fullName: 'Boss', isSuperAdmin: true }) : member({ id: where.id, fullName: where.id })))
    const result = await deleteMembers({ userIds: ['a', 'b', 'boss', 'a'] })
    expect(result).toMatchObject({ ok: true, deleted: 2 })
    expect(result.ok && result.failed).toEqual([expect.stringContaining('Boss')])
    expect(mocks.userDelete).toHaveBeenCalledTimes(2)
  })
})
