'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { Resend } from 'resend'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { CONTACT_EMAIL } from '@/lib/constants'
import { getPublicContact } from '@/lib/settings'
import { logError } from '@/lib/logger'
import { renderEmailTemplate } from '@/lib/email/templates'
import { emailFrom } from '@/lib/email/resend'
import { headers } from 'next/headers'
import { enforceRateLimit } from '@/lib/rate-limit'
import type { ContactSubmitResult } from '@/lib/contact-types'

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional(),
  category: z.string().trim().max(60).optional(),
  message: z.string().trim().min(5).max(5000),
})

// Shared by the full contact page and the public chat widget: creates the
// record the Super Admin sees in Communications and emails a notification to
// the public enquiry destination from site settings.
async function ensureEnquiryDestinationEmail() {
  const existing = await prisma.appSetting.findUnique({
    where: { key: 'contact_destination_email' },
    select: { value: true },
  })
  if (existing?.value?.trim()) return existing.value.trim()
  await prisma.appSetting.upsert({
    where: { key: 'contact_destination_email' },
    create: { key: 'contact_destination_email', value: CONTACT_EMAIL },
    update: { value: CONTACT_EMAIL },
  })
  return CONTACT_EMAIL
}

async function defaultContactRecipients(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { in: ['SECRETARY', 'TREASURER', 'EXECUTIVE'] } },
    select: { email: true },
    take: 20,
  })
  return users.map((user) => user.email.trim().toLowerCase()).filter(Boolean)
}

async function resolveContactAssigneeId() {
  const superAdmin = await prisma.user.findFirst({
    where: { isSuperAdmin: true, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (superAdmin) return superAdmin.id
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  return admin?.id || null
}

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
  const [assignedToId, destinationEmail] = await Promise.all([
    resolveContactAssigneeId(),
    ensureEnquiryDestinationEmail(),
  ])
  const submission = await prisma.$transaction(async (tx) => {
    const saved = await tx.contactSubmission.create({
      data: { name, email, phone: phone || null, category: category || null, message, assignedToId },
    })
    if (assignedToId) {
      await tx.userNotification.create({
        data: {
          userId: assignedToId,
          title: 'New contact enquiry',
          body: `${name} sent a ${category || 'general'} enquiry.`,
          href: '/admin/announcements',
          type: 'contact_enquiry',
          entity: 'ContactSubmission',
          entityId: saved.id,
          audienceRoles: ['ADMIN'],
        },
      })
    }
    return saved
  })
  const { enquiryEmail, recipients } = await getPublicContact()
  // Prefer the Communications / Settings destination; fall back to CONTACT_EMAIL.
  const destination = destinationEmail || enquiryEmail || CONTACT_EMAIL
  const copies = recipients.length ? recipients : await defaultContactRecipients()

  const key = process.env.RESEND_API_KEY
  if (key && !key.startsWith('re_your-')) {
    try {
      const resend = new Resend(key)
      const from = emailFrom()
      // Send the main inbox independently: a failed copy must not block it.
      const to = [destination]
      const rendered = renderEmailTemplate('contact_enquiry', {
        name,
        email,
        phone: phone || '—',
        category: category || 'General',
        message,
      })
      const { error } = await resend.emails.send({
        from,
        to,
        replyTo: email,
        subject: rendered.subject,
        html: rendered.html,
      })
      await prisma.contactSubmission.update({
        where: { id: submission.id },
        data: { emailStatus: error ? 'failed' : 'sent' },
      })
      if (error) logError('contact.email.rejected', error, { submissionId: submission.id })
      const testCopy = process.env.NODE_ENV !== 'production' ? process.env.RESEND_TEST_EMAIL?.trim() : undefined
      const extra = Array.from(new Set([...copies, ...(testCopy ? [testCopy] : [])].map(address => address.trim().toLowerCase())))
        .filter(address => address && address !== destination.toLowerCase())
      for (const address of extra) {
        try {
          const copy = await resend.emails.send({ from, to: address, replyTo: email, subject: rendered.subject, html: rendered.html })
          if (copy.error) logError('contact.email.copies_failed', copy.error, { submissionId: submission.id })
        } catch (copyError) {
          logError('contact.email.copies_failed', copyError, { submissionId: submission.id })
        }
      }
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

  revalidatePath('/admin/announcements')
  revalidatePath('/notifications')
  return submission
}

export async function sendContactMessage(formData: FormData): Promise<ContactSubmitResult> {
  // Honeypot — pretend success so bots don't retry.
  if (String(formData.get('website') || '')) return { ok: true }

  const requestHeaders = await headers()
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip')
  try {
    await enforceRateLimit(`contact:${ip || 'unknown'}`, 5, 60)
  } catch {
    return { ok: false, error: 'rate' }
  }
  // Turnstile captcha temporarily disabled on the contact form.
  const parsed = contactSchema.safeParse({
    name: String(formData.get('name') || ''),
    email: String(formData.get('email') || ''),
    phone: String(formData.get('phone') || '') || undefined,
    category: String(formData.get('category') || '') || undefined,
    message: String(formData.get('message') || ''),
  })
  if (!parsed.success) return { ok: false, error: 'invalid' }

  await createContactSubmissionAndNotify(parsed.data)
  return { ok: true }
}

async function requireAssignedSuperAdmin(id: string) {
  const actor = await requireAdmin()
  if (!actor.isSuperAdmin) throw new Error('Only the Super Admin can manage the contact inbox.')
  const submission = await prisma.contactSubmission.findUniqueOrThrow({ where: { id } })
  if (submission.assignedToId && submission.assignedToId !== actor.id) {
    throw new Error('This enquiry is not assigned to you.')
  }
  if (!submission.assignedToId) {
    await prisma.contactSubmission.update({
      where: { id },
      data: { assignedToId: actor.id },
    })
  }
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

export async function deleteContactMessage(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const id = String(formData.get('id') || '')
    if (!id) return { ok: false, error: 'Message id required' }
    const { actor } = await requireAssignedSuperAdmin(id)

    await prisma.contactSubmission.delete({ where: { id } })
    await writeAudit({
      userId: actor.id,
      action: 'CONTACT_MESSAGE_DELETE',
      entity: 'ContactSubmission',
      entityId: id,
    })
    revalidatePath('/admin/announcements')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not delete message.' }
  }
}

export async function deleteSelectedContactMessages(
  formData: FormData,
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  try {
    const actor = await requireAdmin()
    if (!actor.isSuperAdmin) return { ok: false, error: 'Only the Super Admin can bulk-delete enquiries.' }
    const ids = formData.getAll('ids').map(String).filter(Boolean)
    if (!ids.length) return { ok: false, error: 'Select at least one enquiry.' }

    const allowed = await prisma.contactSubmission.findMany({
      where: {
        id: { in: ids },
        OR: [{ assignedToId: actor.id }, { assignedToId: null }],
      },
      select: { id: true },
    })
    if (!allowed.length) return { ok: false, error: 'No matching enquiries to delete.' }

    const deleteIds = allowed.map((row) => row.id)
    await prisma.contactSubmission.deleteMany({ where: { id: { in: deleteIds } } })
    await Promise.all(
      deleteIds.map((id) =>
        writeAudit({
          userId: actor.id,
          action: 'CONTACT_MESSAGE_DELETE',
          entity: 'ContactSubmission',
          entityId: id,
          meta: { bulk: true },
        }),
      ),
    )
    revalidatePath('/admin/announcements')
    return { ok: true, deleted: deleteIds.length }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not delete enquiries.' }
  }
}

export async function updateContactWorkflow(formData: FormData): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  try {
    const id = z.string().min(1).parse(formData.get('id'))
    const { actor } = await requireAssignedSuperAdmin(id)
    const status = z.enum(['UNREAD', 'IN_PROGRESS', 'RESOLVED', 'SPAM']).parse(formData.get('status'))
    const now = new Date()
    const retainUntil =
      status === 'RESOLVED'
        ? new Date(now.getTime() + 730 * 86400000)
        : status === 'SPAM'
          ? new Date(now.getTime() + 90 * 86400000)
          : null
    await prisma.contactSubmission.update({
      where: { id },
      data: {
        status,
        readAt: now,
        resolvedAt: status === 'RESOLVED' ? now : null,
        spamAt: status === 'SPAM' ? now : null,
        retainUntil,
      },
    })
    await writeAudit({
      userId: actor.id,
      action: 'CONTACT_WORKFLOW_UPDATE',
      entity: 'ContactSubmission',
      entityId: id,
      meta: { status, assignedToId: actor.id, retainUntil },
    })
    revalidatePath('/admin/announcements')
    return { ok: true, status }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not update status.' }
  }
}

export async function replyToContact(
  formData: FormData,
): Promise<{ ok: true; deliveryStatus: string; reply: { id: string; subject: string; body: string; sentAt: string; deliveryStatus: string } } | { ok: false; error: string }> {
  try {
    const id = z.string().min(1).parse(formData.get('id'))
    const { actor, submission } = await requireAssignedSuperAdmin(id)
    const subject = z.string().trim().min(1).max(200).parse(formData.get('subject'))
    const body = z.string().trim().min(1).max(5000).parse(formData.get('body'))
    let deliveryStatus = 'not_configured'
    const key = process.env.RESEND_API_KEY
    if (key && !key.startsWith('re_your-')) {
      const resend = new Resend(key)
      const from = emailFrom()
      // Always reply to the enquiry sender; also copy RESEND_TEST_EMAIL in sandbox/dev.
      const to = process.env.RESEND_TEST_EMAIL
        ? Array.from(new Set([submission.email, process.env.RESEND_TEST_EMAIL].filter(Boolean)))
        : [submission.email]
      const rendered = renderEmailTemplate('contact_reply', {
        name: submission.name,
        subject,
        heading: subject,
        body,
      })
      const { error } = await resend.emails.send({
        from,
        to,
        replyTo: CONTACT_EMAIL,
        subject: rendered.subject,
        html: rendered.html,
      })
      deliveryStatus = error ? 'failed' : 'sent'
    }
    const reply = await prisma.contactReply.create({
      data: { submissionId: id, sentById: actor.id, subject, body, method: 'in_site', deliveryStatus },
    })
    await prisma.contactSubmission.update({
      where: { id },
      data: { status: 'IN_PROGRESS', readAt: new Date() },
    })
    await writeAudit({
      userId: actor.id,
      action: 'CONTACT_REPLY',
      entity: 'ContactSubmission',
      entityId: id,
      meta: { deliveryStatus },
    })
    revalidatePath('/admin/announcements')
    return {
      ok: true,
      deliveryStatus,
      reply: {
        id: reply.id,
        subject: reply.subject,
        body: reply.body,
        sentAt: reply.sentAt.toISOString(),
        deliveryStatus: reply.deliveryStatus,
      },
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not send reply.' }
  }
}

export async function updateContactDestination(formData: FormData) {
  const actor = await requireAdmin()
  if (!actor.isSuperAdmin) throw new Error('Only the Super Admin can change the contact destination.')
  const value = z.string().email().parse(formData.get('email'))
  await prisma.appSetting.upsert({ where: { key: 'contact_destination_email' }, create: { key: 'contact_destination_email', value, updatedBy: actor.id }, update: { value, updatedBy: actor.id } })
  await writeAudit({ userId: actor.id, action: 'CONTACT_DESTINATION_UPDATE', entity: 'AppSetting', entityId: 'contact_destination_email' })
  revalidateTag('app-settings')
  revalidatePath('/admin/announcements')
  revalidatePath('/contact')
}
