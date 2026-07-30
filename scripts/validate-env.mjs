import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env.local')

if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 1) continue
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const required = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_KEY: key,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
}

const missing = Object.entries(required)
  .filter(([, value]) => !value?.trim())
  .map(([name]) => name)

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

try {
  const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (supabaseUrl.protocol !== 'https:' || !supabaseUrl.hostname.endsWith('.supabase.co')) {
    throw new Error('must be an HTTPS *.supabase.co URL')
  }
} catch (error) {
  console.error(`Invalid NEXT_PUBLIC_SUPABASE_URL: ${error.message}`)
  process.exit(1)
}

for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
  const value = process.env[name]
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    console.error(`${name} must be a PostgreSQL connection string`)
    process.exit(1)
  }
}

const optional = [
  'RESEND_API_KEY',
  'FROM_EMAIL',
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_SHORTCODE',
  'MPESA_PASSKEY',
  'MPESA_CALLBACK_URL',
  'CRON_SECRET',
]
const missingOptional = optional.filter((name) => !process.env[name]?.trim())

console.log('Environment validation passed.')
if (missingOptional.length) {
  console.warn(`Optional integrations not configured: ${missingOptional.join(', ')}`)
}
