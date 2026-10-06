import { cache } from 'react'
import { WORKSPACE_COOKIE, selectedWorkspaceMode, selectedWorkspace, workspaceProfile } from './workspace'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { createServerClient as createServiceClient } from '@/lib/supabase-server'
import type { AuthUser, Role } from './types'
import { ROLE_HOME } from './types'
import { isAppRole, toAuthUser } from './helpers'
import { getDisabledRoles, isLockedOutByRole } from '@/lib/disabled-roles'
import { canRecordPayments } from '@/lib/finance-access'
import type { MemberStatus, User } from '@prisma/client'

export type SessionProfile = AuthUser & {
  status: MemberStatus
  authUserId: string | null
  isSuperAdmin: boolean
  dashboardAccess: Role[]
  /** Branch owner for an attached member; null for principals and unattached members. */
  principalMemberId: string | null
  isPrincipal: boolean
}

export type AppMetadataPayload = {
  role: Role
  status: MemberStatus
  isSuperAdmin: boolean
  dashboardAccess: Role[]
  dbUserId: string   // stored so requests can skip the DB lookup
  fullName: string
  isPrincipal?: boolean
  principalMemberId?: string | null
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
    isPrincipal: user.isPrincipal,
    principalMemberId: user.principalMemberId,
  })
}

function makeInitials(fullName: string) {
  return fullName.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export async function getAccountProfile(): Promise<SessionProfile | null> {
  const profile = await loadSessionProfile()
  if (profile && isLockedOutByRole(profile, await getDisabledRoles())) {
    redirect('/api/auth/logout?error=role_inactive')
  }
  return profile
}

/** All page/action authorization uses only the selected workspace. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const account = await getAccountProfile()
  if (!account) return null
  const store = await cookies()
  const profile = workspaceProfile(account, store.get(WORKSPACE_COOKIE)?.value)
  if (isLockedOutByRole(profile, await getDisabledRoles())) redirect('/api/auth/logout?error=role_inactive')
  return profile
}

const loadSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // getUser() validates the JWT with Supabase Auth servers — recommended for server-side auth
  const { data: { user: authUser }, error } = await supabase.auth.getUser()
  if (!authUser || error) return null

  const meta = authUser.app_metadata ?? {}

  // Fast path: JWT already carries everything we need — skip the DB entirely.
  // Tokens minted before branch fields were added lack `principalMemberId`; those must
  // fall through to the DB so branch-scoped queries never run against a missing value.
  if (isAppRole(meta.role) && meta.status && meta.dbUserId && 'principalMemberId' in meta) {
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
      principalMemberId: (meta.principalMemberId ?? null) as string | null,
      isPrincipal: Boolean(meta.isPrincipal),
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
    principalMemberId: profile.principalMemberId ?? null,
    isPrincipal: profile.isPrincipal ?? false,
  }
})

export async function requireSessionProfile() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login?error=session_expired')
  return profile
}

export async function requireActiveRole(roles?: Role[]) {
  const profile = await requireSessionProfile()
  if (profile.status !== 'ACTIVE') {
    redirect('/login?error=inactive')
  }
  if (!roles) return profile
  if (profile.isSuperAdmin || profile.role === 'ADMIN') return profile
  if (roles.includes(profile.role)) return profile
  if ((profile.dashboardAccess ?? []).some((r) => roles.includes(r))) return profile
  redirect(ROLE_HOME[profile.role])
}

/**
 * Strictly the Treasurer, for recording payments and proposing reversals. Unlike
 * `requireActiveRole(['TREASURER'])`, Admin and Super Admin do not pass.
 */
export async function requireTreasurer() {
  const profile = await requireActiveRole(['TREASURER'])
  if (!canRecordPayments(profile)) throw new Error('Only the Treasurer can record or reverse payments.')
  return profile
}

export async function requireAdmin() {
  const profile = await requireActiveRole(['ADMIN'])
  if (profile.role !== 'ADMIN' && !profile.isSuperAdmin) redirect(ROLE_HOME[profile.role])
  return profile
}

export async function getPrismaUserByAuthId(authUserId: string): Promise<User | null> {
  return prisma.user.findFirst({ where: { authUserId } })
}

export async function clearSessionCookie() {}
export async function setSessionCookie(_user: AuthUser) { return '' }

export async function getSessionUser(): Promise<AuthUser | null> {
  const profile = await getAccountProfile()
  if (!profile || profile.status !== 'ACTIVE') return null
  const store = await cookies()
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    initials: profile.initials,
    isSuperAdmin: profile.isSuperAdmin,
    dashboardAccess: profile.dashboardAccess,
    isPrincipal: profile.isPrincipal,
    status: profile.status,
    activeWorkspace: selectedWorkspace(profile, store.get(WORKSPACE_COOKIE)?.value),
    activeSuperAdmin: selectedWorkspaceMode(profile, store.get(WORKSPACE_COOKIE)?.value) === 'SUPER_ADMIN',
  }
}
