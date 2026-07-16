import { createBrowserClient } from '@supabase/ssr'
import { normalizeSupabaseUrl } from '@/lib/supabase-url'

const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!)
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const createClient = () =>
  createBrowserClient(supabaseUrl, supabaseKey!)
