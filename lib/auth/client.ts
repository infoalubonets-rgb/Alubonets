import { ROLE_HOME, type AuthUser, type Role } from './types'

export { ROLE_HOME }
export type { AuthUser, Role }

const fetchOpts: RequestInit = {
  credentials: 'same-origin',
  cache: 'no-store',
}

export async function loginRequest(email: string, password: string, mfaToken?: string) {
  const controller = new AbortController()
  // The dev server compiles the login route on first use, which can take over a minute.
  const timeout = window.setTimeout(() => controller.abort(), process.env.NODE_ENV === 'development' ? 120_000 : 25_000)
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...(mfaToken ? { mfaToken } : {}) }),
      signal: controller.signal,
      ...fetchOpts,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new Error(data.error || 'Invalid credentials') as Error & { requiresMfa?: boolean }
      err.requiresMfa = Boolean(data.requiresMfa)
      throw err
    }
    return data as {
      user: AuthUser
      redirectTo: string
      status?: string
      requiresVerification?: boolean
      requiresMfa?: boolean
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Sign-in timed out. Check your connection and try again.')
    }
    if (err instanceof TypeError) {
      throw new Error('Could not reach the server. Refresh the page and try again.')
    }
    throw err
  } finally {
    window.clearTimeout(timeout)
  }
}

import type { RegistrationInput } from '@/lib/membership'

export async function registerRequest(
  input: RegistrationInput | { email: string; password: string; fullName: string; phone?: string }
) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    ...fetchOpts,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed')
  }
  return data as { user: AuthUser; redirectTo: string; status?: string }
}

export async function logoutRequest() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 2500)
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      signal: controller.signal,
      ...fetchOpts,
    })
  } catch {
    // Network hiccup — callers still redirect
  } finally {
    window.clearTimeout(timeout)
  }
}

export type MeLookup =
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated' }
  | { status: 'unavailable' }

/**
 * Session lookup for the current browser cookies.
 * Distinguishes real logout (401) from temporary network / server issues
 * so a new tab or brief hiccup does not bounce the user to /login.
 */
export async function meLookup(): Promise<MeLookup> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch('/api/auth/me', {
      signal: controller.signal,
      ...fetchOpts,
    })
    if (res.status === 401) return { status: 'unauthenticated' }
    if (!res.ok) return { status: 'unavailable' }
    const data = await res.json()
    if (!data.user) return { status: 'unauthenticated' }
    return { status: 'authenticated', user: data.user as AuthUser }
  } catch {
    return { status: 'unavailable' }
  } finally {
    window.clearTimeout(timeout)
  }
}

/** @deprecated Prefer meLookup() so callers can handle unavailable vs logged-out. */
export async function meRequest(): Promise<AuthUser | null> {
  const result = await meLookup()
  return result.status === 'authenticated' ? result.user : null
}

export function homeForRole(role: Role) {
  return ROLE_HOME[role]
}
