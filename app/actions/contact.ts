'use server'

import { redirect } from 'next/navigation'
import { Resend } from 'resend'

const INBOX = 'infoalubonets@gmail.com'

export async function sendContactMessage(formData: FormData) {
  const name     = (formData.get('name')     as string)?.trim()
  const email    = (formData.get('email')    as string)?.trim()
  const phone    = (formData.get('phone')    as string)?.trim()
  const category = (formData.get('category') as string)?.trim()
  const message  = (formData.get('message')  as string)?.trim()

  if (!name || !email || !message) redirect('/contact?error=missing')

  const key = process.env.RESEND_API_KEY
  if (key && !key.startsWith('re_your-')) {
    const resend = new Resend(key)
    const from = process.env.FROM_EMAIL || 'noreply@alubonets.com'
    await resend.emails.send({
      from,
      to: INBOX,
      replyTo: email,
      subject: `Contact: ${category || 'General'} — ${name}`,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Phone:</strong> ${phone || '—'}</p>
        <p><strong>Category:</strong> ${category || '—'}</p>
        <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;"/>
        <p style="white-space:pre-line;">${message}</p>
      `,
    })
  }

  redirect('/contact?sent=1')
}
