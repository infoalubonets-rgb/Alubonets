import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { baseHtml, emailFrom, testEmailOverride } from '@/lib/email/resend'

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export type MemberSetupEmailResult =
  | { sent: true; deliveredTo: string; redirectedToTestInbox: boolean }
  | { sent: false; error: string }

/**
 * Welcome email for a member an administrator created: their sign-in email, the temporary
 * password, and the one-time setup link to choose their own password. Never throws, so a mail
 * problem cannot undo or hide a member who was already created; the result says what happened.
 */
export async function sendMemberSetupEmail(input: {
  userId: string
  actorId: string
  to: string
  fullName: string
  roleLabel: string
  principalName?: string | null
  setupUrl: string
  temporaryPassword: string
}): Promise<MemberSetupEmailResult> {
  const key = process.env.RESEND_API_KEY
  const subject = 'Your Alubonets account is ready'
  const log = (status: string, meta: Record<string, unknown>) =>
    prisma.emailLog
      .create({ data: { userId: input.userId, toEmail: input.to, subject, template: 'admin_member_invite', status, meta: { actorId: input.actorId, ...meta } } })
      .catch(() => undefined)

  if (!key || key.startsWith('re_your-')) {
    await log('skipped', { reason: 'RESEND_API_KEY not configured' })
    return { sent: false, error: 'Email is not set up on the server (RESEND_API_KEY is missing).' }
  }

  // RESEND_TEST_EMAIL (or the onboarding sender) sends everything to one test inbox instead.
  const override = testEmailOverride()
  const deliveredTo = override || input.to
  const firstName = input.fullName.trim().split(/\s+/)[0] || 'there'
  const html = baseHtml(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Welcome to Alubonets</h2>
    <p style="margin:0 0 12px;color:#374151;">Hello ${esc(firstName)},</p>
    <p style="margin:0 0 16px;color:#374151;line-height:1.6;">An administrator created your Alubonets account as a <strong>${esc(input.roleLabel)}</strong>${
      input.principalName ? ` in <strong>${esc(input.principalName)}</strong>’s family branch` : ''
    }.</p>
    <p style="margin:0 0 20px;"><a href="${esc(input.setupUrl)}" style="display:inline-block;background:#001f50;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Set my password</a></p>
    <p style="margin:0 0 8px;color:#374151;">Or sign in with these details and change your password afterwards:</p>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;border-collapse:collapse;background:#f5f7fa;border-radius:8px;">
      <tr><td style="padding:10px 14px;color:#6b7280;font-size:13px;">Email</td><td style="padding:10px 14px;color:#111827;font-size:14px;font-weight:600;">${esc(input.to)}</td></tr>
      <tr><td style="padding:10px 14px;color:#6b7280;font-size:13px;">Temporary password</td><td style="padding:10px 14px;color:#111827;font-size:14px;font-weight:600;font-family:monospace;">${esc(input.temporaryPassword)}</td></tr>
    </table>
    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">The setup link works once, for 14 days. After signing in you will be asked to complete your profile. If you did not expect this email, you can ignore it.</p>
  `)

  try {
    const { data, error } = await new Resend(key).emails.send({ from: emailFrom(), to: deliveredTo, subject, html })
    if (error) {
      await log('failed', { error: error.message, deliveredTo })
      return { sent: false, error: `The email provider rejected it: ${error.message}` }
    }
    await log('sent', { providerMessageId: data?.id ?? null, deliveredTo, testMode: Boolean(override) })
    return { sent: true, deliveredTo, redirectedToTestInbox: Boolean(override) }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'unknown error'
    await log('failed', { error: message, deliveredTo })
    return { sent: false, error: `Could not reach the email provider: ${message}` }
  }
}
