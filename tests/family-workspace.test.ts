import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), findMany: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findMany: mocks.findMany } } }))
vi.mock('@/components/dashboard/MyFamilyPage', () => ({ default: () => null }))
vi.mock('@/components/dashboard/DashboardShell', () => ({ default: () => null }))
vi.mock('@/components/admin/FamilyAdministrationClient', () => ({
  default: () => null, FamilyAdministrationActions: () => null, FamilyAdministrationFilterSlot: () => null,
}))
import AdminFamilyPage from '@/app/admin/family/page'
import MemberFamilyPage from '@/app/dashboard/member/family/page'

beforeEach(() => vi.resetAllMocks())

describe('family workspace routes', () => {
  it('blocks ordinary members before fetching the full member list', async () => {
    mocks.requireAdmin.mockRejectedValue(new Error('Admin access required'))
    await expect(AdminFamilyPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('Admin access required')
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
  it('renders Member My Family without enabling admin navigation', () => {
    const page = MemberFamilyPage()
    expect(page.props.adminWorkspace).toBeUndefined()
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
  it('keeps the Admin personal-family view separate from the member list', async () => {
    mocks.requireAdmin.mockResolvedValue({ role: 'ADMIN' })
    const page = await AdminFamilyPage({ searchParams: Promise.resolve({ view: 'mine' }) })
    expect(page.props.adminWorkspace).toBe(true)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
