import { createBrowserClient } from '@supabase/ssr'
import { getPublicSupabaseConfig } from '@/lib/env'
import { AUTH_COOKIE_OPTIONS } from '@/lib/auth-cookie-options'

export const createClient = () => {
  const { url, key } = getPublicSupabaseConfig()
  return createBrowserClient(url, key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
  })
}
