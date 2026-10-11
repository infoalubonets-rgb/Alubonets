import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), userUpdate: vi.fn(), profile: vi.fn(), update: vi.fn(), create: vi.fn(), audit: vi.fn() }))
vi.mock('../lib/auth/session', () => ({ requireSessionProfile: m.session, syncUserMetadata: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('../lib/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('../lib/prisma', () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn({ user: { findUnique: m.user, update: m.userUpdate }, committeeProfile: { findFirst: m.profile, update: m.update, create: m.create }, auditLog: { create: m.audit } }) } }))
import { updateMyExecutiveDetails } from '../app/actions/profile'

beforeEach(() => {
  vi.resetAllMocks()
  m.session.mockResolvedValue({ id: 'self' })
  m.user.mockResolvedValue({ id: 'self', fullName: 'Executive', role: 'EXECUTIVE', dashboardAccess: [], aboutTitle: 'Chairperson', aboutOrder: 2, showOnAbout: false })
  m.profile.mockResolvedValue({ id: 'profile', biography: 'Old bio', responsibilities: 'Old duties' })
})
describe('executive self-service About details', () => {
  it('updates only their own content and audits the previous values', async () => {
    await updateMyExecutiveDetails({ biography: 'New bio', responsibilities: 'New duties' })
    expect(m.user).toHaveBeenCalledWith({ where: { id: 'self' } })
    expect(m.profile).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'self' } }))
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'profile' }, data: { biography: 'New bio', responsibilities: 'New duties', editedById: 'self' } })
    expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'self', oldValue: { biography: 'Old bio', responsibilities: 'Old duties', position: 'Chairperson' } }) })
  })
  it('saves a self-entered position to the public title and audits it', async () => {
    await updateMyExecutiveDetails({ position: 'Vice Chairperson', biography: 'Bio', responsibilities: '' })
    expect(m.userUpdate).toHaveBeenCalledWith({ where: { id: 'self' }, data: { aboutTitle: 'Vice Chairperson' } })
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'profile' }, data: { biography: 'Bio', responsibilities: '', position: 'Vice Chairperson', editedById: 'self' } })
    expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ newValue: { position: 'Vice Chairperson', biography: 'Bio', responsibilities: '' } }) })
  })
  it('rejects non-executives on the server', async () => {
    m.user.mockResolvedValue({ id: 'self', role: 'MEMBER', dashboardAccess: [] })
    await expect(updateMyExecutiveDetails({ biography: '', responsibilities: '' })).rejects.toThrow('Only executives')
    expect(m.update).not.toHaveBeenCalled()
  })
  it('accepts the secondary Executive role and preserves administrator publishing settings', async () => {
    m.user.mockResolvedValue({ id: 'self', role: 'SECRETARY', dashboardAccess: ['EXECUTIVE'], fullName: 'Secretary', aboutTitle: 'Secretary', aboutOrder: 3, showOnAbout: false })
    m.profile.mockResolvedValue(null)
    await updateMyExecutiveDetails({ biography: 'Bio', responsibilities: 'Duties' })
    expect(m.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'self', position: 'Secretary', displayOrder: 3, status: 'DRAFT' }) })
  })
  it('rejects attempts to select another account or change publishing permissions', async () => {
    await expect(updateMyExecutiveDetails({ biography: '', responsibilities: '', userId: 'other', showOnAbout: true } as never)).rejects.toThrow()
    expect(m.update).not.toHaveBeenCalled()
  })
  it('fails the save if its audit cannot be recorded', async () => {
    m.audit.mockRejectedValue(new Error('Audit unavailable'))
    await expect(updateMyExecutiveDetails({ biography: '', responsibilities: '' })).rejects.toThrow('Audit unavailable')
  })
})
