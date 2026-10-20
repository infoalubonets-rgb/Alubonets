import { prisma } from '@/lib/prisma'
import { needsProfileCompletion } from '@/lib/profile-completion'

/**
 * What a signed-in person must finish before using the portal:
 * - `application`: signed up (e.g. with Google) but never submitted the membership application.
 * - `profile`: an administrator created the account and important details are still empty.
 * Stored in the auth app_metadata so middleware can enforce it without a database lookup.
 */
export type OnboardingStep = 'application' | 'profile' | null

export async function onboardingStep(userId: string): Promise<OnboardingStep> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      phone: true,
      location: true,
      approvalNotes: true,
      memberProfile: {
        select: {
          gender: true,
          dateOfBirth: true,
          address: true,
          nextOfKinName: true,
          nextOfKinPhone: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
        },
      },
      _count: { select: { consentRecords: true } },
    },
  })
  if (!user) return null
  // Every submitted application records consent; a pending account without one never applied.
  if (user.status === 'PENDING' && user._count.consentRecords === 0) return 'application'
  if (user.status === 'ACTIVE' && needsProfileCompletion(user)) return 'profile'
  return null
}

/** Where to send someone who still has an onboarding step, or null when they are done. */
export function onboardingPath(step: OnboardingStep) {
  if (step === 'application') return '/complete-application'
  if (step === 'profile') return '/profile?complete=1'
  return null
}
