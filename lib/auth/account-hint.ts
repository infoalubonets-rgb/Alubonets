import type { Role } from './types'

/**
 * A non-secret note in this browser of who was last signed in, so the public navbar can show the
 * account button at once instead of flashing "Login / Register" while it asks the server. The
 * server stays the authority: the navbar still checks /api/auth/me and clears this if signed out.
 */
export type AccountHint = { fullName: string; role: Role; isSuperAdmin?: boolean }

const KEY = 'alubonets-account-hint'

export function readAccountHint(): AccountHint | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null')
    return value && typeof value.fullName === 'string' && typeof value.role === 'string' ? value : null
  } catch {
    return null
  }
}

export function writeAccountHint(user: AccountHint) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ fullName: user.fullName, role: user.role, isSuperAdmin: Boolean(user.isSuperAdmin) }))
  } catch {
    // Private mode or storage disabled: the navbar simply waits for the server.
  }
}

export function clearAccountHint() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing stored.
  }
}
