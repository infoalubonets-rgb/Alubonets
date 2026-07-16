import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { createServerClient as createServiceClient } from '@/lib/supabase-server'
import type { AuthUser, Role } from './types'
import { isAppRole, toAuthUser } from './helpers'
import type { MemberStatus, User } from '@prisma/client'

export type SessionProfile = AuthUser & {
  status: MemberStatus
  authUserId: string | null
}

export async function syncAppMetadata(
  authUserId: string,
  role: Role,
  status: MemberStatus
) {
  const admin = createServiceClient()
  await admin.auth.admin.updateUserById(authUserId, {
    app_metadata: { role, status },
  })
}

export async function getSessionProfile(): Promise<SessionProfile | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  let profile = await prisma.user.findFirst({
    where: {
      OR: [{ authUserId: authUser.id }, { email: authUser.email ?? undefined }],
    },
  })

  if (!profile && authUser.email) {
    profile = await prisma.user.create({
      data: {
        authUserId: authUser.id,
        email: authUser.email,
        fullName:
          (authUser.user_metadata?.full_name as string | undefined) ||
          authUser.email.split('@')[0],
        role: 'MEMBER',
        status: 'PENDING',
      },
    })
    await syncAppMetadata(authUser.id, 'MEMBER', 'PENDING')
  }

  if (!profile) return null

  if (!profile.authUserId) {
    profile = await prisma.user.update({
      where: { id: profile.id },
      data: { authUserId: authUser.id },
    })
  }

  const metaRole = authUser.app_metadata?.role
  const metaStatus = authUser.app_metadata?.status
  if (
    profile.authUserId &&
    (!isAppRole(metaRole) || metaRole !== profile.role || metaStatus !== profile.status)
  ) {
    await syncAppMetadata(profile.authUserId, profile.role, profile.status)
  }

  return {
    ...toAuthUser(profile),
    status: profile.status,
    authUserId: profile.authUserId,
  }
}

export async function requireSessionProfile() {
  const profile = await getSessionProfile()
  if (!profile) throw new Error('Unauthorized')
  return profile
}

export async function requireActiveRole(roles?: Role[]) {
  const profile = await requireSessionProfile()
  if (profile.status !== 'ACTIVE') {
    throw new Error('Account is not active')
  }
  if (roles && !roles.includes(profile.role) && profile.role !== 'ADMIN') {
    throw new Error('Forbidden')
  }
  return profile
}

export async function getPrismaUserByAuthId(authUserId: string): Promise<User | null> {
  return prisma.user.findFirst({ where: { authUserId } })
}

/** @deprecated jose cookie session — kept briefly for cleanup phase */
export async function clearSessionCookie() {
  // no-op: Supabase owns cookies
}

/** @deprecated */
export async function setSessionCookie(_user: AuthUser) {
  return ''
}

/** @deprecated */
export async function getSessionUser(): Promise<AuthUser | null> {
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') return null
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    initials: profile.initials,
  }
}
