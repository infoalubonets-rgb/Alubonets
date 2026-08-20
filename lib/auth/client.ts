import { ROLE_HOME, type AuthUser, type Role } from './types'

export { ROLE_HOME }
export type { AuthUser, Role }

export async function loginRequest(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Invalid credentials')
  }
  return data as { user: AuthUser; redirectTo: string; status?: string }
}

import type { RegistrationInput } from '@/lib/membership'

export async function registerRequest(
  input: RegistrationInput | { email: string; password: string; fullName: string; phone?: string }
) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed')
  }
  return data as { user: AuthUser; redirectTo: string; status?: string }
}

export async function logoutRequest() {
  // Bounded so a slow/hanging network call never delays the sign-out
  // redirect — the caller navigates away regardless of the outcome, and a
  // cookie that didn't clear in time just gets re-checked by middleware.
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 2500)
  try {
    await fetch('/api/auth/logout', { method: 'POST', signal: controller.signal })
  } catch {
    // Network hiccup or timeout — callers still redirect, middleware will re-check auth.
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function meRequest(): Promise<AuthUser | null> {
  const res = await fetch('/api/auth/me')
  if (!res.ok) return null
  const data = await res.json()
  return data.user ?? null
}

export function homeForRole(role: Role) {
  return ROLE_HOME[role]
}
