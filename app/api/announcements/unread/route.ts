import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { getUnreadAnnouncementCount } from '@/lib/data/queries'
import type { Role } from '@/lib/auth/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) {
    return NextResponse.json({ count: 0 }, { status: 401 })
  }
  const count = await getUnreadAnnouncementCount(profile.id, profile.role as Role)
  return NextResponse.json({ count })
}
