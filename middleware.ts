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

  if (!isProtectedPath(pathname) && pathname !== '/pending') {
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

  const role = isAppRole(user.app_metadata?.role) ? user.app_metadata.role : null
  const status = isMemberStatus(user.app_metadata?.status)
    ? user.app_metadata.status
    : null
  const isSuperAdmin = Boolean(user.app_metadata?.isSuperAdmin)
  const dashboardAccess = parseDashboardAccess(user.app_metadata?.dashboardAccess)

  // Production hardening: never honor login-verification bypass outside development.
  const allowVerificationBypass =
    process.env.NODE_ENV !== 'production' && process.env.BYPASS_LOGIN_VERIFICATION === 'true'

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

  if (status === 'PENDING') {
    if (pathname === '/profile' || pathname.startsWith('/profile/')) {
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
