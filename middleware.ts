import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  ROLE_HOME,
  allowedDashboards,
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

  // /admin* requires ADMIN primary or Super Admin
  if (target === 'ADMIN') {
    return role === 'ADMIN' || Boolean(opts.isSuperAdmin)
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
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!isProtectedPath(pathname) && pathname !== '/pending') {
    return supabaseResponse
  }

  const redirectWithCookies = (url: URL) => {
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
      redirect.cookies.set(name, value)
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

  const role = isAppRole(user.app_metadata?.role) ? user.app_metadata.role : null
  const status = isMemberStatus(user.app_metadata?.status)
    ? user.app_metadata.status
    : null
  const isSuperAdmin = Boolean(user.app_metadata?.isSuperAdmin)
  const dashboardAccess = parseDashboardAccess(user.app_metadata?.dashboardAccess)

  if (
    process.env.BYPASS_LOGIN_VERIFICATION !== 'true' &&
    status === 'ACTIVE' &&
    isProtectedPath(pathname)
  ) {
    const verificationToken = req.cookies.get('alubonets-verified')?.value
    const verificationHours = role && ['ADMIN', 'EXECUTIVE'].includes(role) ? 6 : 24
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

  // Shared profile, personal contributions & announcements for every authenticated role
  if (
    pathname === '/profile' ||
    pathname.startsWith('/profile/') ||
    pathname === '/contributions' ||
    pathname.startsWith('/contributions/') ||
    pathname === '/announcements' ||
    pathname.startsWith('/announcements/')
  ) {
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
