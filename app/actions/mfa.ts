'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { generateMfaSecret, otpauthUrl, verifyTotp, PRIVILEGED_MFA_ROLES } from '@/lib/mfa-totp'
import { consumeMfaRecoveryCode, generateMfaRecoveryCodes } from '@/lib/mfa-recovery'

/**
 * Starts (or re-starts) authenticator enrollment.
 *
 * Re-enrolling replaces a live second factor, so when MFA is already on the caller must prove
 * possession of the current authenticator first — otherwise a hijacked session could silently
 * swap the factor for one the attacker controls.
 */
export async function beginMfaEnrollment(formData?: FormData) {
  const actor = await requireActiveRole([...PRIVILEGED_MFA_ROLES])
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } })

  if (user.mfaEnabled && user.mfaSecret) {
    const token = z
      .string()
      .trim()
      .min(6)
      .max(8)
      .parse(formData?.get('currentToken'))
    if (!verifyTotp(user.mfaSecret, token)) {
      throw new Error('Enter a code from your current authenticator before setting up a new one.')
    }
  }

  const secret = generateMfaSecret()
  await prisma.user.update({
    where: { id: actor.id },
    data: { mfaSecret: secret, mfaEnabled: false },
  })
  await writeAudit({
    userId: actor.id,
    action: user.mfaEnabled ? 'MFA_RESET_START' : 'MFA_ENROLL_START',
    entity: 'User',
    entityId: actor.id,
    reason: user.mfaEnabled
      ? 'Replaced an existing authenticator after verifying the current one'
      : 'Started authenticator enrollment',
  })

  return {
    secret,
    otpauthUrl: otpauthUrl(secret, actor.email),
  }
}

export async function confirmMfaEnrollment(formData: FormData) {
  const actor = await requireActiveRole([...PRIVILEGED_MFA_ROLES])
  const token = z.string().trim().min(6).max(8).parse(formData.get('token'))
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } })
  if (!user.mfaSecret) throw new Error('Start MFA enrollment first.')
  if (!verifyTotp(user.mfaSecret, token)) throw new Error('Invalid authenticator code.')
  const recovery = generateMfaRecoveryCodes()
  await prisma.user.update({
    where: { id: actor.id },
    data: { mfaEnabled: true, mfaRecoveryCodes: recovery.stored },
  })
  await writeAudit({
    userId: actor.id,
    action: 'MFA_ENABLE',
    entity: 'User',
    entityId: actor.id,
  })
  revalidatePath('/profile')
  return { ok: true, recoveryCodes: recovery.codes }
}

export async function disableMfa(formData: FormData) {
  const actor = await requireActiveRole([...PRIVILEGED_MFA_ROLES])
  const token = z.string().trim().min(6).max(8).parse(formData.get('token'))
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } })
  if (!user.mfaSecret || !user.mfaEnabled) throw new Error('MFA is not enabled.')
  if (!verifyTotp(user.mfaSecret, token)) throw new Error('Invalid authenticator code.')
  await prisma.user.update({
    where: { id: actor.id },
    data: { mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: null },
  })
  await writeAudit({
    userId: actor.id,
    action: 'MFA_DISABLE',
    entity: 'User',
    entityId: actor.id,
  })
  revalidatePath('/profile')
  return { ok: true }
}

export async function verifyMfaLoginCode(userId: string, token: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (!user.mfaEnabled || !user.mfaSecret) return true
  if (verifyTotp(user.mfaSecret, token)) return true
  const remaining = consumeMfaRecoveryCode(user.mfaRecoveryCodes, token)
  if (remaining == null) return false
  await prisma.user.update({
    where: { id: userId },
    data: { mfaRecoveryCodes: remaining },
  })
  await writeAudit({
    userId,
    action: 'MFA_RECOVERY_USED',
    entity: 'User',
    entityId: userId,
  })
  return true
}
