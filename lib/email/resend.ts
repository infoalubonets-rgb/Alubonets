import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import type { User } from '@prisma/client'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key || key.startsWith('re_your-')) return null
  return new Resend(key)
}

const from = () => process.env.FROM_EMAIL || 'noreply@alubonets.com'

export async function sendMemberApprovedEmail(user: User) {
  const resend = getResend()
  const subject = 'Your Alubonets membership was approved'
  const html = `<p>Hello ${user.fullName},</p><p>Your membership is now active. You can log in at ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/login</p>`

  if (!resend) {
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        toEmail: user.email,
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
      to: user.email,
      subject,
      html,
    })
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        toEmail: user.email,
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
        toEmail: user.email,
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
  user: User,
  amount: number,
  ref?: string | null
) {
  const resend = getResend()
  const subject = `Contribution receipt — KES ${amount.toLocaleString()}`
  const html = `<p>Hello ${user.fullName},</p><p>We received your contribution of <strong>KES ${amount.toLocaleString()}</strong>${ref ? ` (ref: ${ref})` : ''}.</p>`

  if (!resend) {
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        toEmail: user.email,
        subject,
        template: 'contribution_receipt',
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
        template: 'contribution_receipt',
        status: 'sent',
      },
    })
  } catch {
    await prisma.emailLog.create({
      data: {
        userId: user.id,
        toEmail: user.email,
        subject,
        template: 'contribution_receipt',
        status: 'failed',
      },
    })
  }
}

export async function sendWelfareStatusEmail(
  user: User,
  status: string,
  note?: string | null
) {
  const resend = getResend()
  const subject = `Welfare request ${status.toLowerCase()}`
  const html = `<p>Hello ${user.fullName},</p><p>Your welfare request is now <strong>${status}</strong>.</p>${note ? `<p>Note: ${note}</p>` : ''}`

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
