import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'
import { appBaseUrl } from '@/lib/app-url'
import type { Contribution, User } from '@prisma/client'
import { buildReceiptPdf } from '@/lib/pdf/receipt'
import { SITE_LOGO, CONTACT_EMAIL, DEFAULT_FROM_EMAIL } from '@/lib/constants'
import { emailFrom } from '@/lib/email/from'

export { emailFrom, normalizeFromAddress } from '@/lib/email/from'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key || key.startsWith('re_your-')) return null
  return new Resend(key)
}

const from = emailFrom
const appUrl = appBaseUrl
/** Escapes text before it goes into email HTML; names and notes are typed by members. */
const esc = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
// When set, ALL outgoing emails are redirected here (use until domain is verified).
// With the Resend onboarding sender, default to the group info inbox.
export const testEmailOverride = () =>
  process.env.RESEND_TEST_EMAIL?.trim() ||
  (from().includes('onboarding@resend.dev') ? CONTACT_EMAIL : null)

/**
 * Where all email goes while in test mode, or null when emails reach their real recipients.
 * Test mode ends once FROM_EMAIL uses a domain verified in Resend and RESEND_TEST_EMAIL is unset.
 */
export function emailTestModeRecipient() {
  return getResend() ? testEmailOverride() : null
}

export function baseHtml(body: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#eef2f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(0,31,80,.12);">
  <div style="background:#001f50;padding:22px 28px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;padding-right:14px;">
        <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" style="height:44px;width:44px;v-text-anchor:middle;" arcsize="50%" fillcolor="#fe8015" strokecolor="#fe8015"><v:fill type="frame" src="${SITE_LOGO}" /></v:roundrect><![endif]-->
        <!--[if !mso]><!-->
        <div style="width:44px;height:44px;border-radius:22px;overflow:hidden;display:inline-block;line-height:0;background:#fe8015;">
          <img src="${SITE_LOGO}" alt="Alubonets" width="44" height="44"
            style="width:44px;height:44px;display:block;" />
        </div>
        <!--<![endif]-->
      </td>
      <td style="vertical-align:middle;">
        <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:-.3px;font-family:sans-serif;">Alubonets SHG</span>
      </td>
    </tr></table>
  </div>
  <div style="height:4px;background:linear-gradient(90deg,#fe8015 0%,#f6b800 55%,#fe8015 100%);"></div>
  <div style="padding:28px 32px;">${body}</div>
  <div style="padding:16px 32px;background:#001f50;">
    <p style="margin:0;color:#c7d2e5;font-size:12px;">Alubonets Self-Help Group · <a href="${appUrl()}" style="color:#fe8015;text-decoration:none;">${appUrl()}</a></p>
  </div>
</div></body></html>`
}

/** Shared body for one-time verification codes (login OTP, registration email verification). */
export function otpCodeHtml(intro: string, code: string) {
  return baseHtml(`<h2 style="margin:0 0 16px;font-size:20px;color:#111827;">${intro}</h2>
    <p style="margin:0 0 20px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#001f50;background:#f5f7fa;border-radius:8px;padding:16px 0;">${code}</p>
    <p style="color:#6b7280;font-size:13px;">This code expires in <strong>10 minutes</strong>. If you did not request it, you can ignore this email.</p>`)
}

export async function sendSupportMessageEmail(input: { memberName: string; memberEmail: string; body: string }) {
  const responders = await prisma.user.findMany({
    where: { status: 'ACTIVE', OR: [{ isSuperAdmin: true }, { role: { in: ['ADMIN', 'EXECUTIVE'] } }] },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
    take: 25,
  })
  if (!responders.length) return { skipped: true as const }
  const override = testEmailOverride()
  const recipients = override ? [{ id: responders[0].id, email: override }] : responders
  const resend = getResend()
  const subject = `Support message from ${input.memberName}`
  const html = baseHtml(`<h2>New support message</h2><p><strong>${esc(input.memberName)}</strong> (${esc(input.memberEmail)}) wrote:</p><p style="white-space:pre-wrap">${esc(input.body)}</p><p><a href="${appUrl()}/support-chat">Open support chat</a></p>`)
  if (!resend) return { skipped: true as const }
  let accepted = 0
  for (const recipient of recipients) {
    const result = await resend.emails.send({ from: from(), to: recipient.email, subject, html })
    if (!result.error) accepted += 1
    await prisma.emailLog.create({ data: { userId: recipient.id, toEmail: recipient.email, subject, template: 'support_message', status: result.error ? 'failed' : 'accepted', meta: { providerMessageId: result.data?.id || null, memberEmail: input.memberEmail } } })
  }
  return { skipped: false as const, accepted: accepted > 0 }
}

export async function sendPasswordResetEmail(input: { userId: string; fullName: string; email: string; resetUrl: string }) {
  const resend = getResend()
  if (!resend) throw new Error('Password-reset email is not configured.')
  // Recovery links must reach the account owner in production, never a test inbox.
  const production = process.env.NODE_ENV === 'production'
  const recipient = production ? input.email : testEmailOverride() || input.email
  const sender = production && from().includes('onboarding@resend.dev') ? DEFAULT_FROM_EMAIL : from()
  const subject = 'Reset your Alubonets password'
  const safeName = input.fullName.replace(/[<>&]/g, '')
  const html = baseHtml(`<h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Reset your password</h2>
    <p style="color:#374151;">Hello ${safeName},</p>
    <p style="color:#374151;line-height:1.6;">This secure reset link expires in <strong>10 minutes</strong> and can only be used once.</p>
    <p><a href="${esc(input.resetUrl)}" style="display:inline-block;background:#003d82;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Reset password</a></p>
    <p style="color:#6b7280;font-size:13px;">If you did not request this, ignore this email. Your password will not change.</p>`)
  let fromUsed = sender
  let delivery = await resend.emails.send({ from: sender, to: recipient, subject, html })
  const sendError = delivery.error?.message || ''
  // A FROM_EMAIL on a domain Resend has not verified (e.g. plain alubonets.com) is refused; retry
  // from the verified info.alubonets.com sender, which can reach any member.
  const senderRefused = /domain|not verified|invalid ['\`]from['\`]|testing emails/i.test(sendError)
  if (delivery.error && senderRefused && sender !== DEFAULT_FROM_EMAIL) {
    logError('auth.password_reset.sender_refused', delivery.error, { userId: input.userId, from: sender })
    fromUsed = DEFAULT_FROM_EMAIL
    delivery = await resend.emails.send({ from: DEFAULT_FROM_EMAIL, to: recipient, subject, html })
  }
  if (delivery.error) {
    // Kept in email_logs so the exact Resend reason can be looked up (Supabase → email_logs).
    await prisma.emailLog
      .create({ data: { userId: input.userId, toEmail: recipient, subject, template: 'password_reset', status: 'failed', meta: { error: delivery.error.message, from: fromUsed } } })
      .catch(() => undefined)
    throw new Error(delivery.error.message)
  }
  // An audit failure must not invalidate a link the provider already accepted.
  try {
    await prisma.emailLog.create({ data: { userId: input.userId, toEmail: recipient, subject, template: 'password_reset', status: 'accepted', meta: { providerMessageId: delivery.data?.id || null, testMode: !production && Boolean(testEmailOverride()), intendedRecipient: input.email, from: fromUsed } } })
  } catch (error) {
    logError('auth.password_reset.email_log_failed', error, { userId: input.userId })
  }
}

type BroadcastAttachment = { filename: string; content: Buffer; contentType?: string }
type BroadcastResult = { userId: string; ok: boolean; error?: string }

// Sends an email to active members (all, or a specific subset by ID)
export async function sendBroadcastEmail({
  subject,
  title,
  body,
  ctaLabel,
  ctaUrl,
  imageUrl,
  template,
  actorId,
  memberIds,
  attachments,
  onProgress,
}: {
  subject: string
  title: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
  imageUrl?: string
  template: string
  actorId?: string
  memberIds?: string[] // if provided, only these members receive the email
  attachments?: BroadcastAttachment[] // forces individual sends — see note below
  onProgress?: (result: BroadcastResult) => void | Promise<void> // fires as each recipient (or batch chunk) completes
}) {
  const resend = getResend()
  const where = memberIds?.length
    ? { id: { in: memberIds }, status: 'ACTIVE' as const }
    : { status: 'ACTIVE' as const }
  const members = await prisma.user.findMany({
    where,
    select: { id: true, email: true, fullName: true },
  })

  const ctaBlock = ctaLabel && ctaUrl
    ? `<p style="margin-top:24px;"><a href="${ctaUrl}" style="display:inline-block;background:#003d82;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${ctaLabel}</a></p>`
    : ''

  const imageBlock = imageUrl
    ? `<img src="${imageUrl}" alt="" style="width:100%;max-height:280px;object-fit:cover;border-radius:8px;margin-bottom:20px;display:block;" />`
    : ''

  const html = (name: string) =>
    baseHtml(`${imageBlock}<h2 style="margin:0 0 16px;font-size:20px;color:#111827;">${title}</h2>
<p style="margin:0 0 8px;color:#374151;">Hello ${esc(name)},</p>
<div style="color:#374151;line-height:1.7;">${body}</div>
${ctaBlock}`)

  if (!members.length) return { sent: 0, failed: 0, results: [] as BroadcastResult[] }

  if (!resend) {
    await prisma.emailLog.create({
      data: {
        userId: actorId ?? null,
        toEmail: 'BROADCAST',
        subject,
        template,
        status: 'skipped',
        meta: { reason: 'RESEND_API_KEY not configured', recipients: members.length },
      },
    })
    return { sent: 0, skipped: members.length }
  }

  const override = testEmailOverride()
  const results: BroadcastResult[] = []
  const record = async (r: BroadcastResult) => {
    results.push(r)
    await onProgress?.(r)
  }

  if (attachments?.length) {
    // Resend's batch endpoint does not support attachments, and duplicating a large
    // attachment across up to 100 batched payloads would balloon the request body —
    // so attachment sends go out one email at a time, a few in flight together.
    const CONCURRENCY = 5
    if (override) {
      const { error } = await resend.emails.send({
        from: from(),
        to: override,
        subject,
        html: html('members'),
        attachments,
      })
      for (const m of members) await record({ userId: m.id, ok: !error, error: error?.message })
    } else {
      let cursor = 0
      const worker = async () => {
        while (cursor < members.length) {
          const m = members[cursor++]
          try {
            const { error } = await resend.emails.send({ from: from(), to: m.email, subject, html: html(m.fullName), attachments })
            await record({ userId: m.id, ok: !error, error: error?.message })
          } catch (err) {
            await record({ userId: m.id, ok: false, error: err instanceof Error ? err.message : 'Send failed' })
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, members.length) }, worker))
    }
  } else if (override) {
    // No domain yet — send one combined email per chunk to the override address
    for (let i = 0; i < members.length; i += 100) {
      const chunk = members.slice(i, i + 100)
      const { error } = await resend.emails.send({
        from: from(),
        to: override,
        subject,
        html: html('members'),
      })
      for (const m of chunk) await record({ userId: m.id, ok: !error, error: error?.message })
    }
  } else {
    // Send in chunks of 100 (Resend batch limit). A chunk fails as a unit — that's a
    // limit of the batch API, not something we can see per-recipient inside one call.
    for (let i = 0; i < members.length; i += 100) {
      const chunk = members.slice(i, i + 100)
      const { error } = await resend.batch.send(
        chunk.map((m) => ({ from: from(), to: m.email, subject, html: html(m.fullName) })),
      )
      for (const m of chunk) await record({ userId: m.id, ok: !error, error: error?.message })
    }
  }

  const sent = results.filter((r) => r.ok).length
  const failed = results.length - sent
  const failureReasons = [...new Set(
    results
      .filter((result) => !result.ok)
      .map((result) => (result.error || 'Email provider rejected the send.')
        .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email redacted]')
        .slice(0, 240)),
  )].slice(0, 3)

  await prisma.emailLog.create({
    data: {
      userId: actorId ?? null,
      toEmail: 'BROADCAST',
      subject,
      template,
      status: failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial',
      meta: {
        sent,
        failed,
        hadAttachments: Boolean(attachments?.length),
        ...(failureReasons.length ? { failureReasons } : {}),
      },
    },
  })
  return { sent, failed, results }
}

export async function sendDirectEmails({
  emails,
  subject,
  title,
  body,
  ctaLabel,
  ctaUrl,
  attachments,
  actorId,
  template,
}: {
  emails: string[]
  subject: string
  title: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
  attachments?: BroadcastAttachment[]
  actorId?: string
  template: string
}) {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))]
  if (!unique.length) return { sent: 0, failed: 0 }

  const resend = getResend()
  if (!resend) {
    await prisma.emailLog.create({
      data: {
        userId: actorId ?? null,
        toEmail: 'DIRECT',
        subject,
        template,
        status: 'skipped',
        meta: { reason: 'RESEND_API_KEY not configured', recipients: unique.length },
      },
    })
    return { sent: 0, failed: unique.length }
  }

  const override = testEmailOverride()
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<p style="margin-top:24px;"><a href="${ctaUrl}" style="display:inline-block;background:#003d82;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${ctaLabel}</a></p>`
      : ''
  const html = (name: string) =>
    baseHtml(`<h2 style="margin:0 0 16px;font-size:20px;color:#111827;">${title}</h2>
<p style="margin:0 0 8px;color:#374151;">Hello ${esc(name)},</p>
<div style="color:#374151;line-height:1.7;">${body}</div>
${ctaBlock}`)

  let sent = 0
  let failed = 0
  for (const email of unique) {
    const to = override || email
    const { error } = await resend.emails.send({
      from: from(),
      to,
      subject,
      html: html('there'),
      attachments,
    })
    if (error) failed += 1
    else sent += 1
  }

  await prisma.emailLog.create({
    data: {
      userId: actorId ?? null,
      toEmail: 'DIRECT',
      subject,
      template,
      status: failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial',
      meta: { sent, failed, external: true },
    },
  })
  return { sent, failed }
}

// Specific helper for gallery photo notifications
export async function sendGalleryNotificationEmail({
  caption,
  category,
  actorId,
}: {
  caption?: string
  category?: string
  actorId: string
}) {
  const captionLine = caption ? `<p style="color:#6b7280;font-style:italic;">"${esc(caption)}"</p>` : ''
  const catLine = category ? `<p style="color:#6b7280;">Category: <strong>${esc(category)}</strong></p>` : ''
  return sendBroadcastEmail({
    subject: 'New photos added to our gallery — Alubonets SHG',
    title: 'New gallery photos',
    body: `New photos have been added to the Alubonets SHG gallery.${captionLine}${catLine}`,
    ctaLabel: 'View Gallery',
    ctaUrl: `${appUrl()}/gallery`,
    template: 'gallery_notification',
    actorId,
  })
}

export async function sendMemberApprovedEmail(user: User) {
  const resend = getResend()
  const recipient = testEmailOverride() || user.email
  const subject = 'Your Alubonets membership was approved'
  const html = baseHtml(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Welcome to Alubonets SHG!</h2>
    <p style="margin:0 0 12px;color:#374151;">Hello ${esc(user.fullName)},</p>
    <p style="margin:0 0 20px;color:#374151;">Your membership has been approved and your account is now active. You can log in and start using the member portal.</p>
    <p><a href="${appUrl()}/login" style="display:inline-block;background:#001f50;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Log in to your account</a></p>
  `)

  if (!resend) {
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        toEmail: recipient,
        subject,
        template: 'member_approved',
        status: 'skipped',
        meta: { reason: 'RESEND_API_KEY not configured' },
      },
    })
    return { skipped: true }
  }

  try {
    await resend.emails.send({
      from: from(),
      to: recipient,
      subject,
      html,
    })
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        toEmail: recipient,
        subject,
        template: 'member_approved',
        status: 'sent',
      },
    })
    return { skipped: false }
  } catch (err) {
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        toEmail: recipient,
        subject,
        template: 'member_approved',
        status: 'failed',
        meta: { error: err instanceof Error ? err.message : 'unknown' },
      },
    })
    return { skipped: false, error: true }
  }
}

export async function sendContributionReceiptEmail(
  contribution: Contribution & { user: User }
) {
  const resend = getResend()
  const { user, amount, mpesaRef: ref } = contribution
  const subject = `Contribution receipt — KES ${amount.toLocaleString()}`
  const html = baseHtml(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Payment received</h2>
    <p style="margin:0 0 12px;color:#374151;">Hello ${esc(user.fullName)},</p>
    <p style="margin:0 0 8px;color:#374151;">We have received your contribution of <strong style="color:#974800;">KES ${Math.round(amount).toLocaleString()}</strong>${ref ? ` (M-Pesa ref: <strong>${esc(ref)}</strong>)` : ''}.</p>
    <p style="margin:0 0 20px;color:#374151;">Your official receipt is attached as a PDF to this email.</p>
    <p style="margin:0;font-size:13px;color:#6b7280;">Thank you for your continued support of Alubonets SHG.</p>
  `)

  if (!resend) {
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        toEmail: user.email,
        subject,
        template: 'contribution_receipt',
        status: 'skipped',
        meta: { reason: 'RESEND_API_KEY not configured' },
      },
    })
    return { skipped: true }
  }

  try {
    const pdfBytes = await buildReceiptPdf(contribution)
    const { error } = await resend.emails.send({
      from: from(),
      to: user.email,
      subject,
      html,
      attachments: [
        {
          filename: `receipt-${contribution.id}.pdf`,
          content: Buffer.from(pdfBytes),
        },
      ],
    })
    if (error) throw new Error(error.message)
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        toEmail: user.email,
        subject,
        template: 'contribution_receipt',
        status: 'sent',
      },
    })
    return { skipped: false }
  } catch (err) {
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        toEmail: user.email,
        subject,
        template: 'contribution_receipt',
        status: 'failed',
        meta: { error: err instanceof Error ? err.message : 'unknown' },
      },
    })
    return { skipped: false, error: true }
  }
}

export async function sendWelfareStatusEmail(
  user: User,
  status: string,
  note?: string | null
) {
  const resend = getResend()
  const subject = `Welfare request ${status.toLowerCase()}`
  const statusColor = status === 'APPROVED' ? '#15803d' : status === 'REJECTED' ? '#dc2626' : '#374151'
  const html = baseHtml(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Welfare request update</h2>
    <p style="margin:0 0 12px;color:#374151;">Hello ${esc(user.fullName)},</p>
    <p style="margin:0 0 12px;color:#374151;">Your welfare request is now <strong style="color:${statusColor};">${esc(status)}</strong>.</p>
    ${note ? `<p style="margin:0;color:#374151;">Note: ${esc(note)}</p>` : ''}
  `)

  if (!resend) {
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        toEmail: user.email,
        subject,
        template: 'welfare_status',
        status: 'skipped',
      },
    })
    return
  }

  try {
    await resend.emails.send({ from: from(), to: user.email, subject, html })
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        toEmail: user.email,
        subject,
        template: 'welfare_status',
        status: 'sent',
      },
    })
  } catch {
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        toEmail: user.email,
        subject,
        template: 'welfare_status',
        status: 'failed',
      },
    })
  }
}

export async function sendFamilyInviteEmail({
  toEmail,
  fullName,
  principalName,
  inviteUrl,
  userId,
}: {
  toEmail: string
  fullName: string
  principalName: string
  inviteUrl: string
  userId: string
}) {
  const resend = getResend()
  const testRecipient = testEmailOverride()
  const recipient = testRecipient || toEmail
  const subject = `${principalName} invited you to Alubonets SHG`
  const html = baseHtml(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Family membership invite</h2>
    <p style="margin:0 0 12px;color:#374151;">Hello ${esc(fullName)},</p>
    <p style="margin:0 0 20px;color:#374151;"><strong>${esc(principalName)}</strong> added you under their family branch on Alubonets. Complete registration to create your login. An administrator may still need to approve your account before portal access.</p>
    <p><a href="${esc(inviteUrl)}" style="display:inline-block;background:#001f50;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Accept invite &amp; register</a></p>
  `)

  if (!resend) {
    await prisma.emailLog.create({
      data: {
        userId,
        toEmail: recipient,
        subject,
        template: 'family_invite',
        status: 'skipped',
        meta: { reason: 'RESEND_API_KEY not configured', inviteUrl },
      },
    })
    return { skipped: true as const }
  }

  try {
    const delivery = await resend.emails.send({ from: from(), to: recipient, subject, html })
    if (delivery.error) throw new Error(delivery.error.message)
    await prisma.emailLog.create({
      data: {
        userId,
        toEmail: recipient,
        subject,
        template: 'family_invite',
        status: 'accepted',
        meta: { inviteUrl, providerMessageId: delivery.data?.id || null, testMode: Boolean(testRecipient), intendedRecipient: toEmail },
      },
    })
    return { skipped: false as const, accepted: true as const, deliveredTo: recipient, providerMessageId: delivery.data?.id, testMode: Boolean(testRecipient) }
  } catch (err) {
    await prisma.emailLog.create({
      data: {
        userId,
        toEmail: recipient,
        subject,
        template: 'family_invite',
        status: 'failed',
        meta: { error: err instanceof Error ? err.message : 'unknown', inviteUrl, testMode: Boolean(testRecipient), intendedRecipient: toEmail },
      },
    })
    return { skipped: true as const, error: true as const, deliveredTo: recipient, testMode: Boolean(testRecipient) }
  }
}

export async function sendFamilyLinkedNoticeEmail({
  member,
  principalName,
}: {
  member: User
  principalName: string
}) {
  if (member.email.endsWith('@alubonets.local') || !member.authUserId) {
    return { skipped: true as const }
  }
  const resend = getResend()
  const recipient = testEmailOverride() || member.email
  const subject = `You were added to ${principalName}'s family branch`
  const html = baseHtml(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Family branch update</h2>
    <p style="margin:0 0 12px;color:#374151;">Hello ${esc(member.fullName)},</p>
    <p style="margin:0 0 20px;color:#374151;">You have been linked under <strong>${esc(principalName)}</strong> on Alubonets. Sign in to view your family branch details.</p>
    <p><a href="${appUrl()}/login" style="display:inline-block;background:#001f50;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Log in</a></p>
  `)

  if (!resend) {
    await prisma.emailLog.create({
      data: {
        userId: member.id,
        toEmail: recipient,
        subject,
        template: 'family_linked',
        status: 'skipped',
      },
    })
    return { skipped: true as const }
  }

  try {
    await resend.emails.send({ from: from(), to: recipient, subject, html })
    await prisma.emailLog.create({
      data: {
        userId: member.id,
        toEmail: recipient,
        subject,
        template: 'family_linked',
        status: 'sent',
      },
    })
    return { skipped: false as const }
  } catch {
    await prisma.emailLog.create({
      data: {
        userId: member.id,
        toEmail: recipient,
        subject,
        template: 'family_linked',
        status: 'failed',
      },
    })
    return { skipped: true as const, error: true as const }
  }
}
