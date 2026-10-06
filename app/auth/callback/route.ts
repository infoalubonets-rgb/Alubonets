import { WORKSPACE_COOKIE } from '@/lib/auth/workspace'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { ROLE_HOME, ALL_ROLES } from '@/lib/auth/types'
import { syncUserMetadata } from '@/lib/auth/session'
import type { Role } from '@prisma/client'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  cookieStore.delete(WORKSPACE_COOKIE)
  const email = data.user.email
  if (!email) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  const fullName =
    (data.user.user_metadata?.full_name as string | undefined) ||
    (data.user.user_metadata?.name as string | undefined) ||
    email.split('@')[0]

  let profile = await prisma.user.findFirst({
    where: {
      OR: [{ authUserId: data.user.id }, { email }],
    },
  })

  if (!profile) {
    profile = await prisma.user.create({
      data: {
        authUserId: data.user.id,
        email,
        fullName,
        role: 'MEMBER',
        status: 'PENDING',
        isSuperAdmin: false,
        dashboardAccess: [],
        avatarUrl: (data.user.user_metadata?.avatar_url as string | undefined) ?? null,
      },
    })
  } else if (!profile.authUserId) {
    profile = await prisma.user.update({
      where: { id: profile.id },
      data: { authUserId: data.user.id },
    })
  }

  // Ensure Super Admin always has full dashboardAccess in JWT
  if (profile.isSuperAdmin && profile.dashboardAccess.length < ALL_ROLES.length) {
    profile = await prisma.user.update({
      where: { id: profile.id },
      data: { dashboardAccess: ALL_ROLES as Role[] },
    })
  }

  await syncUserMetadata(profile)

  if (profile.status === 'PENDING') {
    return NextResponse.redirect(`${origin}/pending`)
  }

  if (profile.status === 'SUSPENDED') {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=suspended`)
  }

  if (profile.status !== 'ACTIVE') {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=inactive`)
  }

  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : ROLE_HOME[profile.role]

  return NextResponse.redirect(`${origin}${safeNext}`)
}
