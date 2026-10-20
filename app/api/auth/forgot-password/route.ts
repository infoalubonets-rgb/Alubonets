export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { clearRateLimit, enforceRateLimit } from '@/lib/rate-limit'
import { createPasswordResetToken, PASSWORD_RESET_TTL_MINUTES } from '@/lib/password-reset'
import { sendPasswordResetEmail } from '@/lib/email/resend'
import { logError } from '@/lib/logger'
import { requestIp } from '@/lib/membership'
import { appBaseUrl } from '@/lib/app-url'

const bodySchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) })

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  // Throttle by IP first so scanning random emails (before we even know if an account exists) is rate-limited.
  const ipAddress = requestIp(request)
  try {
    await enforceRateLimit(`password-reset-request-ip:${ipAddress || 'unknown'}`, 10, 60)
  } catch {
    return NextResponse.json({ error: 'Too many requests. Please wait a bit and try again.' }, { status: 429 })
  }
  // Same answer whether or not the email has an account, so this form cannot be used to
  // discover who is a member. Only the account owner learns more, from their inbox.
  const sentMessage = {
    message: `If an account exists for this email, a secure password-reset link is on its way. It expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.`,
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, email: true, fullName: true, authUserId: true } })
  if (!user?.authUserId) return NextResponse.json(sentMessage)
  const recentReset = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, consumedAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
  })
  if (recentReset) return NextResponse.json(sentMessage)
  // Requesting a link is allowed multiple times; only completing a reset is limited to once per 24h.
  const rateKey = `password-reset-request:${user.id}`
  try { await enforceRateLimit(rateKey, 5, 60) } catch {
    return NextResponse.json(sentMessage)
  }
  const { token, tokenHash } = createPasswordResetToken()
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000)
  const resetUrl = `${appBaseUrl(request.url)}/reset-password?token=${encodeURIComponent(token)}`
  try {
    const record = await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } })
    try { await sendPasswordResetEmail({ userId: user.id, fullName: user.fullName, email: user.email, resetUrl }) }
    catch (error) { await prisma.passwordResetToken.delete({ where: { id: record.id } }); throw error }
    return NextResponse.json({
      ...sentMessage,
      // Resend has no verified sending domain yet, so delivery is limited to the configured test inbox.
      // Surface the link directly here (dev/test only) so the flow can still be tested end-to-end.
      ...(process.env.NODE_ENV !== 'production' ? { testResetUrl: resetUrl } : {}),
    })
  } catch (error) {
    await clearRateLimit(rateKey).catch(() => undefined)
    logError('auth.password_reset.request_failed', error, { userId: user.id })
    return NextResponse.json({ error: 'We could not send the reset email right now. Please try again.' }, { status: 503 })
  }
}
