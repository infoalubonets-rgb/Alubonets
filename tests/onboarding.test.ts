import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ find: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: mocks.find } } }))
import { onboardingPath, onboardingStep } from '@/lib/auth/onboarding'
import { ADMIN_CREATED_NOTE } from '@/lib/profile-completion'

const completeProfile = {
  gender: 'FEMALE',
  dateOfBirth: new Date('1990-01-01'),
  address: 'Butere',
  nextOfKinName: 'Kin',
  nextOfKinPhone: '0700000000',
  emergencyContactName: 'Kin',
  emergencyContactPhone: '0700000000',
}
const user = (overrides: Record<string, unknown>) => ({
  status: 'ACTIVE',
  phone: '0711111111',
  location: 'Butere',
  approvalNotes: null,
  memberProfile: completeProfile,
  _count: { consentRecords: 1 },
  ...overrides,
})

beforeEach(() => vi.resetAllMocks())

describe('onboarding step', () => {
  it('sends a first-time Google sign-in (pending, no consent) to the application', async () => {
    mocks.find.mockResolvedValue(user({ status: 'PENDING', memberProfile: null, _count: { consentRecords: 0 } }))
    expect(await onboardingStep('u1')).toBe('application')
    expect(onboardingPath('application')).toBe('/complete-application')
  })
  it('lets a pending applicant who already submitted wait for approval', async () => {
    mocks.find.mockResolvedValue(user({ status: 'PENDING' }))
    expect(await onboardingStep('u1')).toBeNull()
  })
  it('sends an admin-created account with missing details to My profile', async () => {
    mocks.find.mockResolvedValue(user({ approvalNotes: ADMIN_CREATED_NOTE, phone: null, _count: { consentRecords: 0 } }))
    expect(await onboardingStep('u1')).toBe('profile')
    expect(onboardingPath('profile')).toBe('/profile?complete=1')
  })
  it('clears once the admin-created account has every important detail', async () => {
    mocks.find.mockResolvedValue(user({ approvalNotes: ADMIN_CREATED_NOTE, _count: { consentRecords: 0 } }))
    expect(await onboardingStep('u1')).toBeNull()
  })
  it('never blocks a normal active member', async () => {
    mocks.find.mockResolvedValue(user({ phone: null }))
    expect(await onboardingStep('u1')).toBeNull()
    expect(onboardingPath(null)).toBeNull()
  })
})
