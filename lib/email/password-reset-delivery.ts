import { sendPasswordResetEmail } from '@/lib/email/resend'

/**
 * Password-reset links go out through Resend only, as the branded Alubonets email from
 * support@info.alubonets.com. (A Supabase recovery-email fallback was removed: members should only
 * ever receive the Alubonets message.) Throws with Resend's reason, which is also kept in email_logs.
 */
export async function deliverPasswordResetLink(input: {
  userId: string
  fullName: string
  email: string
  resetUrl: string
  requestUrl?: string
}): Promise<{ channel: 'resend' }> {
  await sendPasswordResetEmail(input)
  return { channel: 'resend' }
}
