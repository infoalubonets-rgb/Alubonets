import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ auth: vi.fn(), target: vi.fn(), profile: vi.fn(), update: vi.fn(), create: vi.fn(), audit: vi.fn() }))
vi.mock('../lib/auth/session', () => ({ requireAdmin: m.auth }))
vi.mock('../lib/audit', () => ({ writeAudit: m.audit }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('../lib/prisma', () => ({ prisma: { user: { findUnique: m.target }, committeeProfile: { findFirst: m.profile }, $transaction: (fn: (tx: unknown) => unknown) => fn({ user: { update: m.update }, committeeProfile: { create: m.create } }) } }))
import { setAboutProfile } from '../app/actions/members'
const settings = { userId: 'exec', showOnAbout: true, aboutTitle: 'Chairperson', aboutOrder: 2, fields: ['photo', 'more', 'biography'], biography: 'A biography', responsibilities: 'Lead meetings' }
beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ id: 'admin' })
  m.target.mockResolvedValue({ id: 'exec', fullName: 'Executive Member', role: 'EXECUTIVE', dashboardAccess: [], showOnAbout: false, aboutTitle: null, aboutOrder: 0, publicProfileFields: [] })
  m.profile.mockResolvedValue(null)
  m.update.mockResolvedValue({ showOnAbout: true, aboutTitle: 'Chairperson', aboutOrder: 2 })
})
describe('admin-managed Executive About profiles', () => {
  it('saves linked biography, position and public fields and audits changes', async () => {
    await setAboutProfile(settings)
    expect(m.auth).toHaveBeenCalledOnce()
    expect(m.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'exec', name: 'Executive Member', position: 'Chairperson', biography: 'A biography' }) })
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'ABOUT_PROFILE_UPDATE', newValue: expect.objectContaining({ biography: 'A biography', fields: ['photo', 'more', 'biography'] }) }))
  })
  it('rejects accounts without Executive access', async () => {
    m.target.mockResolvedValue({ id: 'exec', role: 'MEMBER', dashboardAccess: [] })
    await expect(setAboutProfile(settings)).rejects.toThrow('Only executives')
    expect(m.update).not.toHaveBeenCalled()
  })
  it('accepts an Executive secondary role', async () => {
    m.target.mockResolvedValue({ id: 'exec', fullName: 'Treasurer', role: 'TREASURER', dashboardAccess: ['EXECUTIVE'], publicProfileFields: [] })
    await setAboutProfile(settings)
    expect(m.create).toHaveBeenCalledOnce()
  })
  it('blocks non-admin callers before any write', async () => {
    m.auth.mockRejectedValue(new Error('Admin only'))
    await expect(setAboutProfile(settings)).rejects.toThrow('Admin only')
    expect(m.update).not.toHaveBeenCalled()
  })
})
