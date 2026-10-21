import { DEFAULT_FROM_EMAIL } from '@/lib/constants'

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const VERIFIED_SENDER_DOMAIN =
  DEFAULT_FROM_EMAIL.match(/@([^\s>]+)/)?.[1]?.toLowerCase() ?? 'info.alubonets.com'

function stripWrappingQuotes(value: string) {
  return value.replace(/^[\s'"]+|[\s'"]+$/g, '').replace(/^[“”‘’]+|[“”‘’]+$/g, '').trim()
}

function parseAddress(raw: string): { name: string; email: string } | null {
  const value = stripWrappingQuotes(raw.replace(/^mailto:/i, '').replace(/\s+/g, ' '))
  if (!value) return null

  const angled = value.match(/^(.*)<\s*([^<>@\s]+@[^<>@\s]+)\s*>\s*$/)
  if (angled) {
    return { name: stripWrappingQuotes(angled[1]), email: angled[2].trim() }
  }

  if (EMAIL_RE.test(value)) return { name: '', email: value }

  // "Alubonets support@info.alubonets.com" or a missing closing >
  const loose = value.match(/^(.*?)\s*<?\s*([^\s<>]+@[^\s<>]+)\s*>?$/)
  if (!loose || !EMAIL_RE.test(loose[2])) return null
  const name = stripWrappingQuotes(loose[1].replace(/<\s*$/, ''))
  return { name, email: loose[2] }
}

function formatFrom(name: string, email: string) {
  if (!name) return `Alubonets <${email}>`
  const safeName = name.replace(/[\r\n<>]/g, '').trim() || 'Alubonets'
  const needsQuotes = /[^A-Za-z0-9 !#$%&'*+\-/=?^_`{|}~]/.test(safeName)
  const display = needsQuotes ? `"${safeName.replace(/"/g, '')}"` : safeName
  return `${display} <${email}>`
}

/** Always returns `Name <email@domain>` so Resend does not reject the from field. */
export function normalizeFromAddress(
  raw: string | undefined | null,
  production = process.env.NODE_ENV === 'production',
) {
  const parsed = parseAddress(raw || '')
  if (!parsed || !EMAIL_RE.test(parsed.email)) return DEFAULT_FROM_EMAIL
  const domain = parsed.email.split('@')[1]?.toLowerCase()
  if (production && domain !== VERIFIED_SENDER_DOMAIN) return DEFAULT_FROM_EMAIL
  return formatFrom(parsed.name, parsed.email)
}

export function emailFrom() {
  // Live mail ignores FROM_EMAIL. A value that looks right in Vercel can still be rejected
  // (smart quotes, a missing `>`, wrapping quotes). The verified sender is hardcoded.
  if (process.env.NODE_ENV === 'production') return DEFAULT_FROM_EMAIL
  return normalizeFromAddress(process.env.FROM_EMAIL, false)
}
