import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
export async function GET() {
  const actor = await getSessionProfile()
  if (!actor) return NextResponse.json({ count: 0 }, { status: 401 })
  const isAdmin = actor.isSuperAdmin || actor.role === 'ADMIN'
  const count = await prisma.supportMessage.count({ where: isAdmin ? { readByAdminAt: null, sender: { isSuperAdmin: false, role: { not: 'ADMIN' } } } : { conversation: { userId: actor.id }, senderId: { not: actor.id }, readByMemberAt: null } })
  return NextResponse.json({ count })
}
