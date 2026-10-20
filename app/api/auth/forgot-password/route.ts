export const dynamic = 'force-dynamic'
import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit } from '@/lib/rate-limit'
import { createPasswordResetToken, PASSWORD_RESET_TTL_MINUTES } from '@/lib/password-reset'
import { deliverPasswordResetLink } from '@/lib/email/password-reset-delivery'
import { logError } from '@/lib/logger'
import { requestIp } from '@/lib/membership'
import { appBaseUrl } from '@/lib/app-url'

const bodySchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) })

/**
 * Looks the email up and, only if it belongs to an account, creates a link and emails it through
 * Resend. Runs after the response, so it never slows the form down and never reveals whether the
 * account exists or a send failed; failures are logged (and kept in email_logs with the reason).
 */
async function sendResetIfAccountExists(email: string, requestUrl: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, fullName: true, authUserId: true } })
  if (!user?.authUserId) return
  const recentReset = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, consumedAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
    select: { id: true },
  })
  if (recentReset) return
  // Requesting a link is allowed a few times an hour; completing a reset is limited to once per 24h.
  try {
    await enforceRateLimit(`password-reset-request:${user.id}`, 5, 60)
  } catch {
    return
  }

  const { token, tokenHash } = createPasswordResetToken()
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000)
  const resetUrl = `${appBaseUrl(requestUrl)}/reset-password?token=${encodeURIComponent(token)}`
  try {
    const record = await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } })
    try {
      await deliverPasswordResetLink({ userId: user.id, fullName: user.fullName, email: user.email, resetUrl, requestUrl })
    } catch (error) {
      // An unsent link must not stay valid in the database.
      await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => undefined)
      throw error
    }
  } catch (error) {
    logError('auth.password_reset.request_failed', error, { userId: user.id })
  }
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  // Throttle by IP first so scanning random emails is rate-limited.
  const ipAddress = requestIp(request)
  try {
    await enforceRateLimit(`password-reset-request-ip:${ipAddress || 'unknown'}`, 10, 60)
  } catch {
    return NextResponse.json({ error: 'Too many requests. Please wait a bit and try again.' }, { status: 429 })
  }

  const email = parsed.data.email
  const requestUrl = request.url
  after(() =>
    sendResetIfAccountExists(email, requestUrl).catch((error) => logError('auth.password_reset.background_failed', error)),
  )
  // The same answer, straight away, whether or not the email has an account.
  return NextResponse.json({
    message: `A password-reset link has been sent to ${email}. It expires in ${PASSWORD_RESET_TTL_MINUTES} minutes. Check your spam folder too.`,
  })
}
