'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/audit'
import { enforceRateLimit } from '@/lib/rate-limit'
import { passwordSchema } from '@/lib/password-reset'
import { createServerClient as createServiceClient } from '@/lib/supabase-server'

const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/, 'This setup link is not valid.')

/** The admin-created account behind a setup link, if the link is still usable. */
export async function findSetupInvite(token: string) {
  const parsed = tokenSchema.safeParse(token)
  if (!parsed.success) return null
  const invite = await prisma.familyInvite.findUnique({
    where: { token: parsed.data },
    include: { user: { select: { id: true, email: true, fullName: true, authUserId: true } } },
  })
  if (!invite?.user?.authUserId || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) return null
  return invite
}

/**
 * Sets the member's own password from their setup link. No email code is needed: the link was
 * sent to their email and carries a single-use key. The client then signs them in.
 */
export async function completeAccountSetup(input: { token: string; password: string }): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  try {
    const token = tokenSchema.parse(input.token)
    await enforceRateLimit(`account-setup:${token.slice(0, 16)}`, 10, 15)
    const password = passwordSchema.parse(input.password)
    const invite = await findSetupInvite(token)
    if (!invite?.user?.authUserId) return { ok: false, error: 'This setup link has expired or was already used. Ask an administrator for a new one.' }

    const { error } = await createServiceClient().auth.admin.updateUserById(invite.user.authUserId, { password, email_confirm: true })
    if (error) return { ok: false, error: 'Could not set your password. Please try again.' }
    await prisma.familyInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } })
    await writeAudit({ userId: invite.user.id, action: 'ACCOUNT_SETUP_COMPLETE', entity: 'User', entityId: invite.user.id })
    return { ok: true, email: invite.user.email }
  } catch (cause) {
    if (cause instanceof z.ZodError) return { ok: false, error: cause.issues[0]?.message || 'Check your password.' }
    return { ok: false, error: cause instanceof Error ? cause.message : 'Could not finish setting up your account.' }
  }
}
