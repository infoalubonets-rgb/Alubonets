export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase-server'
import { hashPasswordResetToken, passwordSchema } from '@/lib/password-reset'
import { logError } from '@/lib/logger'
import { enforceRateLimit } from '@/lib/rate-limit'
import { requestIp } from '@/lib/membership'

const bodySchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema })

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid reset request.' }, { status: 400 })
  const ipAddress = requestIp(request)
  try {
    await enforceRateLimit(`password-reset-submit-ip:${ipAddress || 'unknown'}`, 10, 15)
  } catch {
    return NextResponse.json({ error: 'Too many attempts. Please wait and try again.' }, { status: 429 })
  }
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashPasswordResetToken(parsed.data.token) }, include: { user: { select: { authUserId: true } } } })
  if (!record || record.consumedAt || record.expiresAt <= new Date() || !record.user.authUserId) return NextResponse.json({ error: 'This reset link is invalid, expired, or has already been used.' }, { status: 410 })
  const recentReset = await prisma.passwordResetToken.findFirst({
    where: { userId: record.userId, consumedAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
  })
  if (recentReset) {
    return NextResponse.json(
      { error: 'You can only reset your password once every 24 hours. Please try again later.' },
      { status: 429 },
    )
  }
  const claimedAt = new Date()
  const claimed = await prisma.passwordResetToken.updateMany({ where: { id: record.id, consumedAt: null, expiresAt: { gt: claimedAt } }, data: { consumedAt: claimedAt } })
  if (claimed.count !== 1) return NextResponse.json({ error: 'This reset link is invalid, expired, or has already been used.' }, { status: 410 })
  try {
    const { error } = await createServerClient().auth.admin.updateUserById(record.user.authUserId, { password: parsed.data.password })
    if (error) throw error
    await prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id }, consumedAt: null } })
    return NextResponse.json({ message: 'Your password has been changed. You can now sign in.' })
  } catch (error) {
    await prisma.passwordResetToken.updateMany({ where: { id: record.id, consumedAt: claimedAt }, data: { consumedAt: null } })
    logError('auth.password_reset.update_failed', error, { userId: record.userId })
    return NextResponse.json({ error: 'We could not update your password right now. Please try again.' }, { status: 503 })
  }
}
