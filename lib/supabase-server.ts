import { createClient } from '@supabase/supabase-js'
import { normalizeSupabaseUrl } from '@/lib/supabase-url'

export function createServerClient() {
  return createClient(
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
