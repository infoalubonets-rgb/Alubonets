import { createClient } from '@supabase/supabase-js'
import { getServiceSupabaseConfig } from '@/lib/env'

export function createServerClient() {
  const { url, key } = getServiceSupabaseConfig()
  return createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
