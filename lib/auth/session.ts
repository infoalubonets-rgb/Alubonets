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
  isSuperAdmin: boolean
  dashboardAccess: Role[]
}

export type AppMetadataPayload = {
  role: Role
  status: MemberStatus
  isSuperAdmin: boolean
  dashboardAccess: Role[]
  dbUserId: string   // stored so requests can skip the DB lookup
  fullName: string
}

export async function syncAppMetadata(
  authUserId: string,
  payload: AppMetadataPayload | Role,
  status?: MemberStatus,
  isSuperAdmin?: boolean,
  dashboardAccess?: Role[]
) {
  const admin = createServiceClient()
  const meta: AppMetadataPayload =
    typeof payload === 'string'
      ? {
          role: payload,
          status: status!,
          isSuperAdmin: isSuperAdmin ?? false,
          dashboardAccess: dashboardAccess ?? [],
          dbUserId: '',
          fullName: '',
        }
      : payload

  await admin.auth.admin.updateUserById(authUserId, { app_metadata: meta })
}

export async function syncUserMetadata(user: User) {
  if (!user.authUserId) return
  await syncAppMetadata(user.authUserId, {
    role: user.role,
    status: user.status,
    isSuperAdmin: user.isSuperAdmin,
    dashboardAccess: user.dashboardAccess as Role[],
    dbUserId: user.id,
    fullName: user.fullName,
  })
}

function makeInitials(fullName: string) {
  return fullName.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export async function getSessionProfile(): Promise<SessionProfile | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // getUser() validates the JWT with Supabase Auth servers — recommended for server-side auth
  const { data: { user: authUser }, error } = await supabase.auth.getUser()
  if (!authUser || error) return null

  const meta = authUser.app_metadata ?? {}

  // Fast path: JWT already carries everything we need — skip the DB entirely
  if (isAppRole(meta.role) && meta.status && meta.dbUserId) {
    const fullName = (meta.fullName as string) || authUser.email?.split('@')[0] || ''
    return {
      id: meta.dbUserId as string,
      email: authUser.email ?? '',
      fullName,
      initials: makeInitials(fullName),
      role: meta.role as Role,
      status: meta.status as MemberStatus,
      authUserId: authUser.id,
      isSuperAdmin: Boolean(meta.isSuperAdmin),
      dashboardAccess: (meta.dashboardAccess ?? []) as Role[],
    }
  }

  // Slow path: first login or metadata not yet seeded — look up DB once
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
          (authUser.user_metadata?.name as string | undefined) ||
          authUser.email.split('@')[0],
        role: 'MEMBER',
        status: 'PENDING',
        isSuperAdmin: false,
        dashboardAccess: [],
      },
    })
  }

  if (!profile) return null

  if (!profile.authUserId) {
    profile = await prisma.user.update({
      where: { id: profile.id },
      data: { authUserId: authUser.id },
    })
  }

  // Sync in background — next request hits the fast path, this one doesn't wait
  syncUserMetadata(profile).catch(() => {})

  return {
    ...toAuthUser(profile),
    status: profile.status,
    authUserId: profile.authUserId,
    isSuperAdmin: profile.isSuperAdmin ?? false,
    dashboardAccess: (profile.dashboardAccess ?? []) as Role[],
  }
}

export async function requireSessionProfile() {
  const profile = await getSessionProfile()
  if (!profile) throw new Error('Unauthorized')
  return profile
}

export async function requireActiveRole(roles?: Role[]) {
  const profile = await requireSessionProfile()
  if (profile.status !== 'ACTIVE') throw new Error('Account is not active')
  if (!roles) return profile
  if (profile.isSuperAdmin || profile.role === 'ADMIN') return profile
  if (roles.includes(profile.role)) return profile
  if ((profile.dashboardAccess ?? []).some((r) => roles.includes(r))) return profile
  throw new Error('Forbidden')
}

export async function requireAdmin() {
  const profile = await requireActiveRole(['ADMIN'])
  if (profile.role !== 'ADMIN' && !profile.isSuperAdmin) throw new Error('Forbidden')
  return profile
}

export async function getPrismaUserByAuthId(authUserId: string): Promise<User | null> {
  return prisma.user.findFirst({ where: { authUserId } })
}

export async function clearSessionCookie() {}
export async function setSessionCookie(_user: AuthUser) { return '' }

export async function getSessionUser(): Promise<AuthUser | null> {
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') return null
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    initials: profile.initials,
    isSuperAdmin: profile.isSuperAdmin,
    dashboardAccess: profile.dashboardAccess,
    status: profile.status,
  }
}
