import { baseHtml } from '@/lib/email/resend'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export type EmailTemplateKey =
  | 'contact_enquiry'
  | 'contact_reply'
  | 'document_notice'
  | 'generic_notice'

/** Branded Alubonets email bodies — use these instead of raw HTML for outbound mail. */
export function renderEmailTemplate(
  key: EmailTemplateKey,
  vars: Record<string, string>,
): { subject: string; html: string; template: EmailTemplateKey } {
  const v = (name: string, fallback = '') => escapeHtml(vars[name] ?? fallback)

  if (key === 'contact_enquiry') {
    const category = v('category', 'General')
    const name = v('name')
    return {
      template: key,
      subject: vars.subject || `Contact: ${vars.category || 'General'} — ${vars.name || 'Enquiry'}`,
      html: baseHtml(`
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#fe8015;">Contact inbox</p>
        <h2 style="margin:0 0 16px;font-size:22px;color:#001f50;">New enquiry received</h2>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 18px;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:110px;">Name</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Email</td><td style="padding:8px 0;font-size:14px;"><a href="mailto:${v('email')}" style="color:#003d82;">${v('email')}</a></td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Phone</td><td style="padding:8px 0;color:#111827;font-size:14px;">${v('phone', '—')}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Category</td><td style="padding:8px 0;color:#111827;font-size:14px;">${category}</td></tr>
        </table>
        <div style="margin:0;padding:16px 18px;border-radius:12px;background:#f5f7fa;border:1px solid #e5e7eb;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">Message</p>
          <p style="margin:0;white-space:pre-line;color:#374151;line-height:1.65;font-size:14px;">${v('message')}</p>
        </div>
        <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">Open Communications → Contact inbox to reply.</p>
      `),
    }
  }

  if (key === 'contact_reply') {
    const name = v('name', 'there')
    return {
      template: key,
      subject: vars.subject || 'Re: Your Alubonets enquiry',
      html: baseHtml(`
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#fe8015;">Alubonets reply</p>
        <h2 style="margin:0 0 12px;font-size:22px;color:#001f50;">${v('heading', 'Response to your enquiry')}</h2>
        <p style="margin:0 0 16px;color:#374151;font-size:14px;">Hello ${name},</p>
        <div style="margin:0 0 18px;padding:16px 18px;border-radius:12px;background:#f5f7fa;border:1px solid #e5e7eb;">
          <p style="margin:0;white-space:pre-line;color:#374151;line-height:1.65;font-size:14px;">${v('body')}</p>
        </div>
        <p style="margin:0;color:#6b7280;font-size:13px;">If you need anything else, reply to this email or use the contact form on our website.</p>
      `),
    }
  }

  if (key === 'document_notice') {
    return {
      template: key,
      subject: vars.subject || 'Document update — Alubonets',
      html: baseHtml(`
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#fe8015;">Documents</p>
        <h2 style="margin:0 0 12px;font-size:22px;color:#001f50;">${v('title', 'Document update')}</h2>
        <p style="margin:0 0 16px;white-space:pre-line;color:#374151;line-height:1.65;font-size:14px;">${v('body')}</p>
        ${vars.ctaUrl ? `<p style="margin:0;"><a href="${escapeHtml(vars.ctaUrl)}" style="display:inline-block;background:#001f50;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;">${v('ctaLabel', 'Open documents')}</a></p>` : ''}
      `),
    }
  }

  return {
    template: 'generic_notice',
    subject: vars.subject || 'Alubonets notification',
    html: baseHtml(`
      <h2 style="margin:0 0 12px;font-size:22px;color:#001f50;">${v('title', 'Notification')}</h2>
      <p style="margin:0;white-space:pre-line;color:#374151;line-height:1.65;font-size:14px;">${v('body')}</p>
    `),
  }
}
