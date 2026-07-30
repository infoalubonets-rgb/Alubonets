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

export async function sendContactMessage(formData: FormData) {
  const parsed = contactSchema.safeParse({
    name: String(formData.get('name') || ''),
    email: String(formData.get('email') || ''),
    phone: String(formData.get('phone') || '') || undefined,
    category: String(formData.get('category') || '') || undefined,
    message: String(formData.get('message') || ''),
  })
  if (!parsed.success) redirect('/contact?error=invalid')
  const { name, email, phone, category, message } = parsed.data

  const submission = await prisma.contactSubmission.create({
    data: {
      name,
      email,
      phone: phone || null,
      category: category || null,
      message,
    },
  })

  const key = process.env.RESEND_API_KEY
  if (key && !key.startsWith('re_your-')) {
    try {
      const resend = new Resend(key)
      const from =
        process.env.FROM_EMAIL || 'Alubonets <onboarding@resend.dev>'
      const { error } = await resend.emails.send({
        from,
        to: CONTACT_EMAIL,
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

  redirect('/contact?sent=1')
}

export async function markContactMessageRead(formData: FormData) {
  const actor = await requireAdmin()
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Message id required')

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
  revalidatePath('/admin/contact-messages')
}

export async function deleteContactMessage(formData: FormData) {
  const actor = await requireAdmin()
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Message id required')

  await prisma.contactSubmission.delete({ where: { id } })
  await writeAudit({
    userId: actor.id,
    action: 'CONTACT_MESSAGE_DELETE',
    entity: 'ContactSubmission',
    entityId: id,
  })
  revalidatePath('/admin/contact-messages')
}
