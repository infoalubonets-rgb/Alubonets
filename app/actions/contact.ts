'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Resend } from 'resend'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { CONTACT_EMAIL } from '@/lib/constants'
import { logError } from '@/lib/logger'
import { headers } from 'next/headers'
import { enforceRateLimit } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/turnstile'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional(),
  category: z.string().trim().max(60).optional(),
  message: z.string().trim().min(5).max(5000),
})

// Shared by the full contact page and the public chat widget: creates the
// record the Super Admin sees in Communications and email a
// notification. Emails route through RESEND_TEST_EMAIL (same as the rest of
// the app) until a verified sending domain replaces the Resend sandbox.
async function createContactSubmissionAndNotify({
  name,
  email,
  phone,
  category,
  message,
}: {
  name: string
  email: string
  phone?: string
  category?: string
  message: string
}) {
  const assignedAdmin = await prisma.user.findFirst({
    where: { isSuperAdmin: true, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  const submission = await prisma.contactSubmission.create({
    data: {
      name,
      email,
      phone: phone || null,
      category: category || null,
      message,
      assignedToId: assignedAdmin?.id || null,
    },
  })
  const configuredDestination =
    (await prisma.appSetting.findUnique({ where: { key: 'contact_destination_email' } }))?.value || CONTACT_EMAIL
  const destination = process.env.RESEND_TEST_EMAIL || configuredDestination

  const key = process.env.RESEND_API_KEY
  if (key && !key.startsWith('re_your-')) {
    try {
      const resend = new Resend(key)
      const from = process.env.FROM_EMAIL || 'Alubonets <onboarding@resend.dev>'
      const { error } = await resend.emails.send({
        from,
        to: destination,
        replyTo: email,
        subject: `Contact: ${category || 'General'} — ${name}`,
        html: `
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
          <p><strong>Phone:</strong> ${escapeHtml(phone || '—')}</p>
          <p><strong>Category:</strong> ${escapeHtml(category || '—')}</p>
          <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;"/>
          <p style="white-space:pre-line;">${escapeHtml(message)}</p>
        `,
      })
      await prisma.contactSubmission.update({
        where: { id: submission.id },
        data: { emailStatus: error ? 'failed' : 'sent' },
      })
    } catch (error) {
      logError('contact.email.failed', error, { submissionId: submission.id })
      await prisma.contactSubmission.update({
        where: { id: submission.id },
        data: { emailStatus: 'failed' },
      })
    }
  } else {
    await prisma.contactSubmission.update({
      where: { id: submission.id },
      data: { emailStatus: 'not_configured' },
    })
  }

  return submission
}

export async function sendContactMessage(formData: FormData) {
  if (String(formData.get('website') || '')) redirect('/contact?sent=1')
  const requestHeaders = await headers()
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip')
  try {
    await enforceRateLimit(`contact:${ip || 'unknown'}`, 5, 60)
  } catch {
    redirect('/contact?error=rate')
  }
  const captchaOk = await verifyTurnstile(String(formData.get('cf-turnstile-response') || ''), ip)
  if (!captchaOk) redirect('/contact?error=captcha')
  const parsed = contactSchema.safeParse({
    name: String(formData.get('name') || ''),
    email: String(formData.get('email') || ''),
    phone: String(formData.get('phone') || '') || undefined,
    category: String(formData.get('category') || '') || undefined,
    message: String(formData.get('message') || ''),
  })
  if (!parsed.success) redirect('/contact?error=invalid')

  await createContactSubmissionAndNotify(parsed.data)

  redirect('/contact?sent=1')
}

async function requireAssignedSuperAdmin(id: string) {
  const actor = await requireAdmin()
  if (!actor.isSuperAdmin) throw new Error('Only the Super Admin can manage the contact inbox.')
  const submission = await prisma.contactSubmission.findUniqueOrThrow({ where: { id } })
  if (submission.assignedToId !== actor.id) throw new Error('This enquiry is not assigned to you.')
  return { actor, submission }
}

export async function markContactMessageRead(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Message id required')
  const { actor } = await requireAssignedSuperAdmin(id)

  await prisma.contactSubmission.update({
    where: { id },
    data: { readAt: new Date() },
  })
  await writeAudit({
    userId: actor.id,
    action: 'CONTACT_MESSAGE_READ',
    entity: 'ContactSubmission',
    entityId: id,
  })
  revalidatePath('/admin/announcements')
}

export async function deleteContactMessage(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Message id required')
  const { actor } = await requireAssignedSuperAdmin(id)

  await prisma.contactSubmission.delete({ where: { id } })
  await writeAudit({
    userId: actor.id,
    action: 'CONTACT_MESSAGE_DELETE',
    entity: 'ContactSubmission',
    entityId: id,
  })
  revalidatePath('/admin/announcements')
}

export async function updateContactWorkflow(formData: FormData) {
  const id = z.string().min(1).parse(formData.get('id'))
  const { actor } = await requireAssignedSuperAdmin(id)
  const status = z.enum(['UNREAD', 'IN_PROGRESS', 'RESOLVED', 'SPAM']).parse(formData.get('status'))
  const now = new Date()
  const retainUntil = status === 'RESOLVED' ? new Date(now.getTime() + 730 * 86400000) : status === 'SPAM' ? new Date(now.getTime() + 90 * 86400000) : null
  await prisma.contactSubmission.update({ where: { id }, data: { status, readAt: now, resolvedAt: status === 'RESOLVED' ? now : null, spamAt: status === 'SPAM' ? now : null, retainUntil } })
  await writeAudit({ userId: actor.id, action: 'CONTACT_WORKFLOW_UPDATE', entity: 'ContactSubmission', entityId: id, meta: { status, assignedToId: actor.id, retainUntil } })
  revalidatePath('/admin/announcements')
}

export async function replyToContact(formData: FormData) {
  const id = z.string().min(1).parse(formData.get('id'))
  const { actor, submission } = await requireAssignedSuperAdmin(id)
  const subject = z.string().trim().min(1).max(200).parse(formData.get('subject'))
  const body = z.string().trim().min(1).max(5000).parse(formData.get('body'))
  let deliveryStatus = 'not_configured'
  const key = process.env.RESEND_API_KEY
  if (key && !key.startsWith('re_your-')) {
    const recipient = process.env.RESEND_TEST_EMAIL || submission.email
    const { error } = await new Resend(key).emails.send({ from: process.env.FROM_EMAIL || 'Alubonets <onboarding@resend.dev>', to: recipient, replyTo: CONTACT_EMAIL, subject, html: `<p style="white-space:pre-line">${escapeHtml(body)}</p>` })
    deliveryStatus = error ? 'failed' : 'sent'
  }
  await prisma.contactReply.create({ data: { submissionId: id, sentById: actor.id, subject, body, method: 'in_site', deliveryStatus } })
  await prisma.contactSubmission.update({ where: { id }, data: { status: 'IN_PROGRESS', readAt: new Date() } })
  await writeAudit({ userId: actor.id, action: 'CONTACT_REPLY', entity: 'ContactSubmission', entityId: id, meta: { deliveryStatus } })
  revalidatePath('/admin/announcements')
}

export async function updateContactDestination(formData: FormData) {
  const actor = await requireAdmin()
  if (!actor.isSuperAdmin) throw new Error('Only the Super Admin can change the contact destination.')
  const value = z.string().email().parse(formData.get('email'))
  await prisma.appSetting.upsert({ where: { key: 'contact_destination_email' }, create: { key: 'contact_destination_email', value, updatedBy: actor.id }, update: { value, updatedBy: actor.id } })
  await writeAudit({ userId: actor.id, action: 'CONTACT_DESTINATION_UPDATE', entity: 'AppSetting', entityId: 'contact_destination_email' })
  revalidatePath('/admin/announcements')
  revalidatePath('/contact')
}
