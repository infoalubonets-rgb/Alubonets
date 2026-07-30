import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPublicSupabaseConfig } from '@/lib/env'

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  const { url, key } = getPublicSupabaseConfig()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component — safe to ignore when middleware
          // refreshes the session.
        }
      },
    },
  })
}
