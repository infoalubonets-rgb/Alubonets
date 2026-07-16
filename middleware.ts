import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { ROLE_HOME, type Role } from '@/lib/auth/types'
import { isAppRole, isMemberStatus } from '@/lib/auth/helpers'
import { normalizeSupabaseUrl } from '@/lib/supabase-url'

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith('/dashboard') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  )
}

function allowedPath(role: Role, pathname: string) {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return role === 'ADMIN'
  }
  if (role === 'ADMIN') {
    return pathname.startsWith('/dashboard')
  }
  const home = ROLE_HOME[role]
  return pathname === home || pathname.startsWith(`${home}/`)
}

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: { headers: req.headers },
  })

  const supabase = createServerClient(
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

  const { pathname } = req.nextUrl

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
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return redirectWithCookies(url)
  }

  const role = isAppRole(user.app_metadata?.role) ? user.app_metadata.role : null
  const status = isMemberStatus(user.app_metadata?.status)
    ? user.app_metadata.status
    : null

  // Missing claims → send to login so login route can sync metadata
  if (!role || !status) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return redirectWithCookies(url)
  }

  if (status === 'PENDING') {
    if (pathname !== '/pending') {
      const url = req.nextUrl.clone()
      url.pathname = '/pending'
      return redirectWithCookies(url)
    }
    return supabaseResponse
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

  if (!allowedPath(role, pathname)) {
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
