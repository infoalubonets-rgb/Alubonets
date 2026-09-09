/** Role emails/labels — passwords come from NEXT_PUBLIC_* env at build time. */
export const TEST_ACCOUNT_META: { email: string; label: string }[] = [
  { email: 'superadmin@alubonets.com', label: 'Super Admin' },
  { email: 'admin@alubonets.com', label: 'Admin' },
  { email: 'executive@alubonets.com', label: 'Executive' },
  { email: 'treasurer@alubonets.com', label: 'Treasurer' },
  { email: 'secretary@alubonets.com', label: 'Secretary' },
  { email: 'organizer@alubonets.com', label: 'Organizer' },
  { email: 'principal@alubonets.com', label: 'Principal Member' },
  { email: 'member@alubonets.com', label: 'Member' },
  { email: 'pending@alubonets.com', label: 'Member (pending)' },
]

export type DevAccount = { email: string; password: string; label: string }

/**
 * Local: on unless NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS=false.
 * Production/live: off unless NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS=true (explicit opt-in on Vercel).
 */
export function testAccountsEnabled() {
  if (process.env.NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS === 'false') return false
  if (process.env.NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS === 'true') return true
  return process.env.NODE_ENV !== 'production'
}

/** Autofill list. Passwords from public env — anyone can see them when this is enabled. */
export function getTestAccounts(): DevAccount[] {
  if (!testAccountsEnabled()) return []

  const seedPassword = process.env.NEXT_PUBLIC_SEED_AUTH_PASSWORD || ''
  const superPassword = process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD || seedPassword
  const superEmail = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || '').trim().toLowerCase()

  const accounts: DevAccount[] = TEST_ACCOUNT_META.map((account) => {
    const isListedSuper = account.email === 'superadmin@alubonets.com'
    return {
      label: account.label,
      email: isListedSuper && superEmail ? superEmail : account.email,
      password: isListedSuper ? superPassword : seedPassword,
    }
  })

  if (superEmail && !accounts.some((a) => a.email.toLowerCase() === superEmail)) {
    accounts.unshift({
      email: superEmail,
      password: superPassword,
      label: 'Super Admin',
    })
  }

  const seen = new Set<string>()
  return accounts.filter((a) => {
    const key = a.email.toLowerCase()
    if (!a.email || !a.password || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
