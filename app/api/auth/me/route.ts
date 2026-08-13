import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { initialsFromName } from '@/lib/auth/helpers'

export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  const current = await prisma.user.findUnique({
    where: { id: profile.id },
    select: { fullName: true, isPrincipal: true },
  })
  const fullName = current?.fullName || profile.fullName
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
      isPrincipal: current?.isPrincipal ?? profile.isPrincipal ?? false,
    },
  })
}
