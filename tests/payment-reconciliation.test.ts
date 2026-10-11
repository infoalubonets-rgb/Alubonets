import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ auth: vi.fn(), payment: vi.fn(), member: vi.fn(), update: vi.fn(), transactionUpdate: vi.fn(), reconciliation: vi.fn(), audit: vi.fn(), standing: vi.fn(), obligation: vi.fn() }))
vi.mock('../lib/auth/session', () => ({ requireActiveRole: m.auth }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('../lib/data/queries', () => ({ TAGS: { contributions: 'contributions' } }))
vi.mock('../lib/finance', () => ({ recomputeStandingSafely: m.standing, refreshObligation: m.obligation }))
vi.mock('../lib/prisma', () => ({ prisma: {
  contribution: { findUniqueOrThrow: m.payment }, user: { findUnique: m.member },
  $transaction: (fn: (tx: unknown) => unknown) => fn({ contribution: { updateMany: m.update }, financialTransaction: { update: m.transactionUpdate }, reconciliation: { upsert: m.reconciliation }, auditLog: { create: m.audit } }),
} }))
import { reconcileContribution } from '../app/actions/finance'
function form(memberId = 'new') { const f = new FormData(); f.set('id', 'payment'); f.set('memberId', memberId); f.set('notes', 'Correct email matched to statement'); return f }
beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ id: 'treasurer', role: 'TREASURER' })
  m.payment.mockResolvedValue({ id: 'payment', userId: 'old', status: 'CONFIRMED', amount: 1200, statementRef: null, campaignId: 'campaign', user: { id: 'old', fullName: 'Old member', email: 'old@example.com' }, financialTransaction: { id: 'ledger', periodId: 'period', period: { status: 'CLOSED' } } })
  m.member.mockResolvedValue({ id: 'new', fullName: 'New member', email: 'new@example.com', isPrincipal: false, principalMemberId: 'family' })
  m.update.mockResolvedValue({ count: 1 })
})
describe('payment member reconciliation', () => {
  it('changes attribution and writes both emails with actor and reason in the same transaction', async () => {
    await reconcileContribution(form())
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'new', principalMemberId: 'family', status: 'RECONCILED' }) }))
    expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'treasurer', action: 'CONTRIBUTION_MEMBER_REASSIGN', reason: 'Correct email matched to statement', oldValue: expect.objectContaining({ memberId: 'old', email: 'old@example.com' }), newValue: expect.objectContaining({ memberId: 'new', email: 'new@example.com' }) }) })
    expect(m.standing).toHaveBeenCalledWith('old', 'treasurer')
    expect(m.standing).toHaveBeenCalledWith('new', 'treasurer')
    expect(m.obligation).toHaveBeenCalledTimes(2)
  })
  it('also corrects an already reconciled payment', async () => {
    const row = await m.payment()
    m.payment.mockResolvedValue({ ...row, status: 'RECONCILED' })
    await reconcileContribution(form())
    expect(m.reconciliation).toHaveBeenCalledOnce()
  })
  it('prevents Super Admin from assigning a payment to themselves', async () => {
    m.auth.mockResolvedValue({ id: 'new', role: 'ADMIN', isSuperAdmin: true })
    await expect(reconcileContribution(form())).rejects.toThrow('cannot assign')
    expect(m.update).not.toHaveBeenCalled()
  })
  it('rejects missing members and concurrent changes', async () => {
    m.member.mockResolvedValueOnce(null)
    await expect(reconcileContribution(form())).rejects.toThrow('existing member')
    m.update.mockResolvedValueOnce({ count: 0 })
    await expect(reconcileContribution(form())).rejects.toThrow('Refresh')
    expect(m.audit).not.toHaveBeenCalled()
  })
  it('fails the transaction when the required audit record cannot be saved', async () => {
    m.audit.mockRejectedValueOnce(new Error('Audit unavailable'))
    await expect(reconcileContribution(form())).rejects.toThrow('Audit unavailable')
    expect(m.standing).not.toHaveBeenCalled()
  })
})
