export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { clearRateLimit, enforceRateLimit } from '@/lib/rate-limit'
import { createPasswordResetToken, PASSWORD_RESET_TTL_MINUTES } from '@/lib/password-reset'
import { sendPasswordResetEmail } from '@/lib/email/resend'
import { logError } from '@/lib/logger'

const bodySchema = z.object({ email: z.string().trim().toLowerCase().email() })

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, email: true, fullName: true, authUserId: true } })
  if (!user?.authUserId) return NextResponse.json({ error: 'No account exists with this email address. Check the details and try again.' }, { status: 404 })
  const rateKey = `password-reset:${user.id}`
  try { await enforceRateLimit(rateKey, 1, 24 * 60) } catch {
    return NextResponse.json({ error: 'A password-reset email has already been requested for this account in the last 24 hours.' }, { status: 429 })
  }
  const { token, tokenHash } = createPasswordResetToken()
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000)
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}/reset-password?token=${encodeURIComponent(token)}`
  try {
    const record = await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } })
    try { await sendPasswordResetEmail({ userId: user.id, fullName: user.fullName, email: user.email, resetUrl }) }
    catch (error) { await prisma.passwordResetToken.delete({ where: { id: record.id } }); throw error }
    return NextResponse.json({ message: 'A secure password-reset link has been sent. It expires in 10 minutes.' })
  } catch (error) {
    await clearRateLimit(rateKey).catch(() => undefined)
    logError('auth.password_reset.request_failed', error, { userId: user.id })
    return NextResponse.json({ error: 'We could not send the reset email right now. Please try again.' }, { status: 503 })
  }
}
