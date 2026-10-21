import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findUnique: vi.fn(),
  userDelete: vi.fn(),
  supportingDocumentDeleteMany: vi.fn(),
  supportMessageDeleteMany: vi.fn(),
  transitionDeleteMany: vi.fn(),
  historyDeleteMany: vi.fn(),
  writeAudit: vi.fn(),
  deleteAuthUser: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({ requireAdmin: mocks.requireAdmin, requireActiveRole: vi.fn(), syncUserMetadata: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    supportingDocument: { deleteMany: mocks.supportingDocumentDeleteMany },
    supportMessage: { deleteMany: mocks.supportMessageDeleteMany },
    familyAccountTransition: { deleteMany: mocks.transitionDeleteMany },
    familyBranchHistory: { deleteMany: mocks.historyDeleteMany },
    user: { delete: mocks.userDelete },
  }
  return { prisma: { user: { findUnique: mocks.findUnique }, $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } }
})
vi.mock('@/lib/audit', () => ({ writeAudit: mocks.writeAudit }))
vi.mock('@/lib/supabase-server', () => ({ createServerClient: () => ({ auth: { admin: { deleteUser: mocks.deleteAuthUser } } }) }))
vi.mock('@/lib/email/resend', () => ({ sendMemberApprovedEmail: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('next/server', () => ({ after: vi.fn() }))

import { deleteMember } from '@/app/actions/members'

const member = (extra: Record<string, unknown> = {}, counts: Record<string, number> = {}) => ({
  id: 'm1', fullName: 'Jane Member', email: 'jane@example.com', role: 'MEMBER', status: 'RESIGNED', isSuperAdmin: false,
  authUserId: 'auth-1', membershipNumber: 'AL-1',
  _count: { attachedMembers: 0, createdFinancialTransactions: 0, approvedFinancialTransactions: 0, ...counts },
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAdmin.mockResolvedValue({ id: 'admin', isSuperAdmin: true })
  mocks.deleteAuthUser.mockResolvedValue({ error: null })
})

describe('deleting a member', () => {
  it('removes the member, their blocking records and their sign-in, and audits it', async () => {
    mocks.findUnique.mockResolvedValue(member())
    expect(await deleteMember({ userId: 'm1' })).toEqual({ ok: true })
    expect(mocks.supportingDocumentDeleteMany).toHaveBeenCalled()
    expect(mocks.historyDeleteMany).toHaveBeenCalledWith({ where: { memberId: 'm1' } })
    expect(mocks.userDelete).toHaveBeenCalledWith({ where: { id: 'm1' } })
    expect(mocks.writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'MEMBER_DELETE', entityId: 'm1' }))
    expect(mocks.deleteAuthUser).toHaveBeenCalledWith('auth-1')
  })

  it('refuses self, Super Admins, principals with attached members and ledger-linked members', async () => {
    mocks.findUnique.mockResolvedValueOnce(member({ id: 'admin' }))
    expect(await deleteMember({ userId: 'admin' })).toMatchObject({ ok: false })
    mocks.findUnique.mockResolvedValueOnce(member({ isSuperAdmin: true }))
    expect(await deleteMember({ userId: 'm1' })).toMatchObject({ ok: false })
    mocks.findUnique.mockResolvedValueOnce(member({}, { attachedMembers: 2 }))
    expect(await deleteMember({ userId: 'm1' })).toMatchObject({ ok: false, error: expect.stringContaining('attached') })
    mocks.findUnique.mockResolvedValueOnce(member({}, { createdFinancialTransactions: 1 }))
    expect(await deleteMember({ userId: 'm1' })).toMatchObject({ ok: false, error: expect.stringContaining('ledger') })
    expect(mocks.userDelete).not.toHaveBeenCalled()
  })

  it('only a Super Admin can delete an Admin', async () => {
    mocks.requireAdmin.mockResolvedValue({ id: 'admin', isSuperAdmin: false })
    mocks.findUnique.mockResolvedValue(member({ role: 'ADMIN' }))
    expect(await deleteMember({ userId: 'm1' })).toMatchObject({ ok: false, error: expect.stringContaining('Super Admin') })
  })

  it('explains when kept records still point at the member', async () => {
    mocks.findUnique.mockResolvedValue(member())
    mocks.userDelete.mockRejectedValue(Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' }))
    expect(await deleteMember({ userId: 'm1' })).toMatchObject({ ok: false, error: expect.stringContaining('Resigned or Inactive') })
    expect(mocks.writeAudit).not.toHaveBeenCalled()
  })
})
