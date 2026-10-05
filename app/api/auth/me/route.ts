import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { initialsFromName } from '@/lib/auth/helpers'
import { logError } from '@/lib/logger'
import { getDisabledRoles } from '@/lib/disabled-roles'

export async function GET() {
  try {
    const profile = await getSessionProfile()
    if (!profile) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    let fullName = profile.fullName
    let isPrincipal = profile.isPrincipal ?? false
    try {
      const current = await Promise.race([
        prisma.user.findUnique({
          where: { id: profile.id },
          select: { fullName: true, isPrincipal: true },
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4_000)),
      ])
      if (current) {
        fullName = current.fullName || fullName
        isPrincipal = current.isPrincipal
      }
    } catch (cause) {
      logError('auth.me.profile_lookup', cause, { userId: profile.id })
    }

    return NextResponse.json({
      user: {
        id: profile.id,
        email: profile.email,
        fullName,
        role: profile.role,
        initials: initialsFromName(fullName),
        status: profile.status,
        isSuperAdmin: profile.isSuperAdmin,
        dashboardAccess: profile.dashboardAccess,
        isPrincipal,
        disabledRoles: await getDisabledRoles().catch(() => []),
      },
    })
  } catch (cause) {
    logError('auth.me.failed', cause)
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
