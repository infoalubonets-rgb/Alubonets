import { createBrowserClient } from '@supabase/ssr'
import { getPublicSupabaseConfig } from '@/lib/env'

export const createClient = () => {
  const { url, key } = getPublicSupabaseConfig()
  return createBrowserClient(url, key)
}
