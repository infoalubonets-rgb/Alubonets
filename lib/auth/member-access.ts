import { getSessionProfile, type SessionProfile } from '@/lib/auth/session'
import { getMemberStanding } from '@/lib/membership-standing-sync'
import { hasPaidUpAccess } from '@/lib/membership-standing'

export type MemberAccess =
  | { state: 'anonymous'; profile: null; reason: null }
  | { state: 'lapsed'; profile: SessionProfile; reason: string | null }
  | { state: 'paid'; profile: SessionProfile; reason: null }

/**
 * Registered (logged-in, ACTIVE login) members see past events and the gallery;
 * only paid-up members see upcoming events and projects.
 */
export async function getMemberAccess(): Promise<MemberAccess> {
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') return { state: 'anonymous', profile: null, reason: null }
  const { standing, reason } = await getMemberStanding(profile.id)
  if (hasPaidUpAccess({ role: profile.role, isSuperAdmin: profile.isSuperAdmin, standing })) {
    return { state: 'paid', profile, reason: null }
  }
  return { state: 'lapsed', profile, reason }
}
