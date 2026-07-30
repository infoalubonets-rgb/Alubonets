import { createClient } from '@supabase/supabase-js'
import { getPublicSupabaseConfig } from '@/lib/env'

const { url, key } = getPublicSupabaseConfig()

/** Simple client without cookie/SSR session handling. Prefer `@/utils/supabase/*` in app code. */
export const supabase = createClient(url, key)
