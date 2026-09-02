import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import type { Contribution, User } from '@prisma/client'
import { buildReceiptPdf } from '@/lib/pdf/receipt'
import { SITE_LOGO } from '@/lib/constants'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key || key.startsWith('re_your-')) return null
  return new Resend(key)
}

const from = () =>
  process.env.FROM_EMAIL || 'Alubonets <onboarding@resend.dev>'
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
// When set, ALL outgoing emails are redirected here (use until domain is verified)
const testEmailOverride = () => process.env.RESEND_TEST_EMAIL || null

function baseHtml(body: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f7fa;font-family:sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.07);">
  <div style="background:#001f50;padding:20px 28px;">
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
        <span style="color:#fff;font-size:17px;font-weight:700;letter-spacing:-.3px;font-family:sans-serif;">Alubonets SHG</span>
      </td>
    </tr></table>
  </div>
  <div style="height:3px;background:#fe8015;"></div>
  <div style="padding:28px 32px;">${body}</div>
  <div style="padding:16px 32px;background:#f5f7fa;border-top:1px solid #e5e7eb;">
    <p style="margin:0;color:#9ca3af;font-size:12px;">Alubonets Self-Help Group · <a href="${appUrl()}" style="color:#9ca3af;">${appUrl()}</a></p>
  </div>
</div></body></html>`
}

export async function sendSupportMessageEmail(input: { memberName: string; memberEmail: string; body: string }) {
  const admin = await prisma.user.findFirst({ where: { isSuperAdmin: true, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' }, select: { id: true, email: true } })
  if (!admin) return { skipped: true as const }
  const recipient = testEmailOverride() || admin.email
  const resend = getResend()
  const subject = `Support message from ${input.memberName}`
  const html = baseHtml(`<h2>New support message</h2><p><strong>${input.memberName}</strong> (${input.memberEmail}) wrote:</p><p style="white-space:pre-wrap">${input.body.replace(/[<>&]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]!))}</p><p><a href="${appUrl()}/support-chat">Open support chat</a></p>`)
  if (!resend) return { skipped: true as const }
  const result = await resend.emails.send({ from: from(), to: recipient, subject, html })
  await prisma.emailLog.create({ data: { userId: admin.id, toEmail: recipient, subject, template: 'support_message', status: result.error ? 'failed' : 'accepted', meta: { providerMessageId: result.data?.id || null, memberEmail: input.memberEmail } } })
  return { skipped: false as const, accepted: !result.error }
}

export async function sendPasswordResetEmail(input: { userId: string; fullName: string; email: string; resetUrl: string }) {
  const resend = getResend()
  if (!resend) throw new Error('Password-reset email is not configured.')
  const recipient = testEmailOverride() || input.email
  const subject = 'Reset your Alubonets password'
  const safeName = input.fullName.replace(/[<>&]/g, '')
  const html = baseHtml(`<h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Reset your password</h2>
    <p style="color:#374151;">Hello ${safeName},</p>
    <p style="color:#374151;line-height:1.6;">This secure reset link expires in <strong>10 minutes</strong> and can only be used once.</p>
    <p><a href="${input.resetUrl}" style="display:inline-block;background:#003d82;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Reset password</a></p>
    <p style="color:#6b7280;font-size:13px;">If you did not request this, ignore this email. Your password will not change.</p>`)
  const delivery = await resend.emails.send({ from: from(), to: recipient, subject, html })
  if (delivery.error) throw new Error(delivery.error.message)
  await prisma.emailLog.create({ data: { userId: input.userId, toEmail: recipient, subject, template: 'password_reset', status: 'accepted', meta: { providerMessageId: delivery.data?.id || null, testMode: Boolean(testEmailOverride()), intendedRecipient: input.email } } })
}

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
<p style="margin:0 0 8px;color:#374151;">Hello ${name},</p>
<div style="color:#374151;line-height:1.7;">${body}</div>
${ctaBlock}`)

  if (!resend) {
    await prisma.emailLog.create({
      data: {
        userId: actorId ?? '',
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
  // Send in chunks of 100 (Resend batch limit)
  let sent = 0
  for (let i = 0; i < members.length; i += 100) {
    const chunk = members.slice(i, i + 100)
    if (override) {
      // No domain yet — send one combined email to the override address
      const names = chunk.map((m) => m.fullName).join(', ')
      await resend.emails.send({
        from: from(),
        to: override,
        subject: `[TEST — would go to ${chunk.length} member(s): ${names}] ${subject}`,
        html: html('members'),
      })
    } else {
      await resend.batch.send(
        chunk.map((m) => ({
          from: from(),
          to: m.email,
          subject,
          html: html(m.fullName),
        })),
      )
    }
    sent += chunk.length
  }

  await prisma.emailLog.create({
    data: {
      userId: actorId ?? '',
      toEmail: 'BROADCAST',
      subject,
      template,
      status: 'sent',
      meta: { sent },
    },
  })
  return { sent }
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
  const captionLine = caption ? `<p style="color:#6b7280;font-style:italic;">"${caption}"</p>` : ''
  const catLine = category ? `<p style="color:#6b7280;">Category: <strong>${category}</strong></p>` : ''
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
  const recipient = process.env.RESEND_TEST_EMAIL || user.email
  const subject = 'Your Alubonets membership was approved'
  const html = baseHtml(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Welcome to Alubonets SHG!</h2>
    <p style="margin:0 0 12px;color:#374151;">Hello ${user.fullName},</p>
    <p style="margin:0 0 20px;color:#374151;">Your membership has been approved and your account is now active. You can log in and start using the member portal.</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/login" style="display:inline-block;background:#001f50;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Log in to your account</a></p>
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
    <p style="margin:0 0 12px;color:#374151;">Hello ${user.fullName},</p>
    <p style="margin:0 0 8px;color:#374151;">We have received your contribution of <strong style="color:#974800;">KES ${Math.round(amount).toLocaleString()}</strong>${ref ? ` (M-Pesa ref: <strong>${ref}</strong>)` : ''}.</p>
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
    <p style="margin:0 0 12px;color:#374151;">Hello ${user.fullName},</p>
    <p style="margin:0 0 12px;color:#374151;">Your welfare request is now <strong style="color:${statusColor};">${status}</strong>.</p>
    ${note ? `<p style="margin:0;color:#374151;">Note: ${note}</p>` : ''}
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
    <p style="margin:0 0 12px;color:#374151;">Hello ${fullName},</p>
    <p style="margin:0 0 20px;color:#374151;"><strong>${principalName}</strong> added you under their family branch on Alubonets. Complete registration to create your login. An administrator may still need to approve your account before portal access.</p>
    <p><a href="${inviteUrl}" style="display:inline-block;background:#001f50;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Accept invite &amp; register</a></p>
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
    <p style="margin:0 0 12px;color:#374151;">Hello ${member.fullName},</p>
    <p style="margin:0 0 20px;color:#374151;">You have been linked under <strong>${principalName}</strong> on Alubonets. Sign in to view your family branch details.</p>
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
