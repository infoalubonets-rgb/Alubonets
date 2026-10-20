import { WORKSPACE_COOKIE, workspaceCookieValue, workspaceProfile } from '@/lib/auth/workspace'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  ROLE_HOME,
  allowedDashboards,
  isSharedAuthenticatedPath,
  roleForDashboardPath,
  type Role,
} from '@/lib/auth/types'
import { isAppRole, isMemberStatus } from '@/lib/auth/helpers'
import { normalizeSupabaseUrl } from '@/lib/supabase-url'
import { jwtVerify } from 'jose'
import { EMAIL_VERIFICATION_ON } from '@/lib/auth/email-verification-switch'

function isProtectedPath(pathname: string) {
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return false
  }
  return (
    pathname.startsWith('/dashboard') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/profile' ||
    pathname.startsWith('/profile/') ||
    pathname === '/contributions' ||
    pathname.startsWith('/contributions/') ||
    pathname === '/announcements' ||
    pathname.startsWith('/announcements/')
    || pathname === '/financial-reports'
    || pathname.startsWith('/financial-reports/')
    || pathname === '/documents'
    || pathname.startsWith('/documents/')
    || pathname === '/governance'
    || pathname.startsWith('/governance/')
    || pathname === '/directory'
    || pathname.startsWith('/directory/')
    || pathname === '/today'
    || pathname.startsWith('/today/')
    || pathname === '/notifications'
  )
}

function parseDashboardAccess(raw: unknown): Role[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isAppRole)
}

function allowedPath(
  role: Role,
  pathname: string,
  opts: { isSuperAdmin?: boolean; dashboardAccess?: Role[] }
) {
  const target = roleForDashboardPath(pathname)
  if (!target) return false

  // /admin* requires ADMIN primary or Super Admin — except read-only audit logs for Auditors.
  if (target === 'ADMIN') {
    if (
      (pathname === '/admin/audit-logs' || pathname.startsWith('/admin/audit-logs/')) &&
      (role === 'AUDITOR' || opts.dashboardAccess?.includes('AUDITOR'))
    ) {
      return true
    }
    return role === 'ADMIN' || Boolean(opts.isSuperAdmin)
  }

  // The Secretary shares event management with the Organizing Secretary.
  if (
    (pathname === '/dashboard/organizer/events' || pathname.startsWith('/dashboard/organizer/events/')) &&
    (role === 'SECRETARY' || opts.dashboardAccess?.includes('SECRETARY'))
  ) {
    return true
  }

  const allowed = allowedDashboards({
    role,
    isSuperAdmin: opts.isSuperAdmin,
    dashboardAccess: opts.dashboardAccess,
  })
  return allowed.includes(target)
}

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: { headers: req.headers },
  })

  const { pathname } = req.nextUrl
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Keep the public site available during initial local setup. Authentication
  // and protected routes still require real Supabase credentials in .env.local.
  if (!supabaseUrl || !supabaseKey) {
    if (isProtectedPath(pathname)) {
      const url = req.nextUrl.clone()
      url.pathname =
        pathname === '/admin' || pathname.startsWith('/admin/')
          ? '/admin/login'
          : '/login'
      url.searchParams.set('error', 'supabase_not_configured')
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  const supabase = createServerClient(
    normalizeSupabaseUrl(supabaseUrl),
    supabaseKey,
    {
      cookieOptions: {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 400,
      },
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              path: '/',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 400,
              ...options,
            }),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!isProtectedPath(pathname) && pathname !== '/pending' && pathname !== '/complete-application') {
    return supabaseResponse
  }

  const redirectWithCookies = (url: URL) => {
    const redirect = NextResponse.redirect(url)
    // Copy refreshed Auth cookies onto the redirect response (keep path/sameSite/maxAge)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value, {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 400,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        expires: cookie.expires,
      })
    })
    return redirect
  }

  if (!user) {
    const url = req.nextUrl.clone()
    const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/')
    url.pathname = isAdminPath ? '/admin/login' : '/login'
    url.searchParams.set('next', pathname)
    return redirectWithCookies(url)
  }

  // Idle session timeout (default 12 hours). Privileged roles can use SESSION_IDLE_MINUTES.
  const idleMinutes = Number(process.env.SESSION_IDLE_MINUTES || 720)
  if (Number.isFinite(idleMinutes) && idleMinutes > 0) {
    const lastActiveRaw = req.cookies.get('alubonets_last_active')?.value
    const lastActiveMs = lastActiveRaw ? Number(lastActiveRaw) : Date.now()
    if (Number.isFinite(lastActiveMs) && Date.now() - lastActiveMs > idleMinutes * 60_000) {
      await supabase.auth.signOut()
      const url = req.nextUrl.clone()
      url.pathname = pathname.startsWith('/admin') ? '/admin/login' : '/login'
      url.searchParams.set('error', 'session_timeout')
      const redirect = redirectWithCookies(url)
      redirect.cookies.set('alubonets_last_active', '', { path: '/', maxAge: 0 })
      return redirect
    }
    supabaseResponse.cookies.set('alubonets_last_active', String(Date.now()), {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 400,
      httpOnly: true,
    })
  }

  const accountRole = isAppRole(user.app_metadata?.role) ? user.app_metadata.role : null
  const status = isMemberStatus(user.app_metadata?.status)
    ? user.app_metadata.status
    : null
  const accountSuperAdmin = Boolean(user.app_metadata?.isSuperAdmin)
  const accountAccess = parseDashboardAccess(user.app_metadata?.dashboardAccess)
  let role = accountRole
  let isSuperAdmin = accountSuperAdmin
  let dashboardAccess = accountAccess
  if (accountRole) {
    const account = {
      id: String(user.app_metadata?.dbUserId || user.id), role: accountRole,
      isSuperAdmin: accountSuperAdmin, dashboardAccess: accountAccess,
    }
    let preference = req.cookies.get(WORKSPACE_COOKIE)?.value
    // Initialize old sessions from their current dashboard; subsequent navigation cannot
    // silently restore the account's original privileges after a workspace switch.
    if (!preference?.startsWith(`${account.id}:`)) {
      const pathRole = roleForDashboardPath(pathname)
      const initialRole = pathRole && allowedDashboards(account).includes(pathRole)
        ? (pathRole === 'ADMIN' && accountSuperAdmin ? 'SUPER_ADMIN' : pathRole) : accountSuperAdmin ? 'SUPER_ADMIN' : accountRole
      preference = workspaceCookieValue(account.id, initialRole)
      const existingCookies = supabaseResponse.cookies.getAll()
      req.cookies.set(WORKSPACE_COOKIE, preference)
      supabaseResponse = NextResponse.next({ request: req })
      existingCookies.forEach(cookie => supabaseResponse.cookies.set(cookie))
      supabaseResponse.cookies.set(WORKSPACE_COOKIE, preference, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
      })
    }
    const effective = workspaceProfile(account, preference)
    role = effective.role
    isSuperAdmin = effective.isSuperAdmin
    dashboardAccess = effective.dashboardAccess
  }

  // Production hardening: never honor login-verification bypass outside development.
  // Also skipped while sign-in email codes are switched off (lib/auth/email-verification-switch.ts).
  const allowVerificationBypass =
    !EMAIL_VERIFICATION_ON ||
    (process.env.NODE_ENV !== 'production' && process.env.BYPASS_LOGIN_VERIFICATION === 'true')

  if (
    !allowVerificationBypass &&
    status === 'ACTIVE' &&
    isProtectedPath(pathname) &&
    pathname !== '/verify-login'
  ) {
    const verificationToken = req.cookies.get('alubonets-verified')?.value
    // Keep verification aligned with cookie lifetime so a new tab does not feel like a logout
    const verificationHours = 24
    let recentlyVerified = false
    if (verificationToken && process.env.JWT_SECRET) {
      try {
        const { payload } = await jwtVerify(verificationToken, new TextEncoder().encode(process.env.JWT_SECRET))
        recentlyVerified = payload.sub === user.app_metadata?.dbUserId && typeof payload.verifiedAt === 'number' && Date.now() - payload.verifiedAt < verificationHours * 3600000
      } catch { recentlyVerified = false }
    }
    if (!recentlyVerified) {
      const url = req.nextUrl.clone()
      url.pathname = '/verify-login'
      return redirectWithCookies(url)
    }
  }

  if (!role || !status) {
    const url = req.nextUrl.clone()
    const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/')
    url.pathname = isAdminPath ? '/admin/login' : '/login'
    url.searchParams.set('next', pathname)
    return redirectWithCookies(url)
  }

  // Unfinished sign-up (lib/auth/onboarding.ts): nothing else opens until it is done.
  const onboarding = user.app_metadata?.onboarding
  const onProfile = pathname === '/profile' || pathname.startsWith('/profile/')
  if (onboarding === 'application') {
    if (pathname === '/complete-application') return supabaseResponse
    const url = req.nextUrl.clone()
    url.pathname = '/complete-application'
    url.search = ''
    return redirectWithCookies(url)
  }
  if (pathname === '/complete-application') {
    const url = req.nextUrl.clone()
    url.pathname = status === 'PENDING' ? '/pending' : ROLE_HOME[role]
    return redirectWithCookies(url)
  }
  if (onboarding === 'profile' && status === 'ACTIVE' && !onProfile) {
    const url = req.nextUrl.clone()
    url.pathname = '/profile'
    url.search = '?complete=1'
    return redirectWithCookies(url)
  }

  if (status === 'PENDING') {
    if (onProfile) {
      return supabaseResponse
    }
    if (pathname !== '/pending') {
      const url = req.nextUrl.clone()
      url.pathname = '/pending'
      return redirectWithCookies(url)
    }
    return supabaseResponse
  }

  if (status === 'SUSPENDED') {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'suspended')
    await supabase.auth.signOut()
    return redirectWithCookies(url)
  }

  if (status !== 'ACTIVE') {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'inactive')
    await supabase.auth.signOut()
    return redirectWithCookies(url)
  }

  if (pathname === '/pending') {
    const url = req.nextUrl.clone()
    url.pathname = ROLE_HOME[role]
    return redirectWithCookies(url)
  }

  // Shared portals (profile, contributions, announcements, governance, documents, reports).
  // Page-level requireActiveRole still enforces manage vs view access.
  if (isSharedAuthenticatedPath(pathname)) {
    return supabaseResponse
  }

  if (!allowedPath(role, pathname, { isSuperAdmin, dashboardAccess })) {
    const url = req.nextUrl.clone()
    url.pathname = ROLE_HOME[role]
    return redirectWithCookies(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
