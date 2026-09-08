import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPublicSupabaseConfig } from '@/lib/env'
import { AUTH_COOKIE_OPTIONS } from '@/lib/auth-cookie-options'

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  const { url, key } = getPublicSupabaseConfig()
  return createServerClient(url, key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...AUTH_COOKIE_OPTIONS,
              ...options,
              path: options?.path ?? AUTH_COOKIE_OPTIONS.path,
              sameSite: options?.sameSite ?? AUTH_COOKIE_OPTIONS.sameSite,
            }),
          )
        } catch {
          // Called from a Server Component — middleware refreshes the session.
        }
      },
    },
  })
}
