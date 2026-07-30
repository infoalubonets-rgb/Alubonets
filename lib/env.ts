type PublicSupabaseConfig = {
  url: string
  key: string
}

function required(name: string, value: string | undefined) {
  const normalized = value?.trim()
  if (!normalized) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return normalized
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const url = required(
    'NEXT_PUBLIC_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ).replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '')
  const key = required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

  return { url, key }
}

export function getServiceSupabaseConfig() {
  const publicConfig = getPublicSupabaseConfig()
  return {
    url: publicConfig.url,
    key: required(
      'SUPABASE_SERVICE_ROLE_KEY',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  }
}

export function getEnvironmentStatus() {
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    supabasePublishableKey: Boolean(publishableKey?.trim()),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    databaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    directUrl: Boolean(process.env.DIRECT_URL?.trim()),
    appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
  }
}
