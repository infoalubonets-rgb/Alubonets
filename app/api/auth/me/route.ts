import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'

export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  return NextResponse.json({
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      initials: profile.initials,
      status: profile.status,
    },
  })
}
