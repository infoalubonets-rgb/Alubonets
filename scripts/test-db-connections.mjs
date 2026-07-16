import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvLocal() {
  const path = resolve(root, '.env.local')
  try {
    const raw = readFileSync(path, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
    return true
  } catch {
    console.error('FAIL: .env.local not found')
    return false
  }
}

function normalizeSupabaseUrl(url) {
  return url.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '')
}

function envStatus(name) {
  const value = process.env[name]
  if (!value) return 'missing'
  if (
    value.includes('your-') ||
    value.includes('[YOUR-') ||
    value.includes('xxxx')
  ) {
    return 'placeholder'
  }
  return 'set'
}

loadEnvLocal()

console.log('Env check (.env.local):\n')
const envVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
]
for (const name of envVars) {
  console.log(`  ${name}: ${envStatus(name)}`)
}

const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
if (supabaseUrl) {
  console.log('\n  URL diagnostics (no secrets shown):')
  console.log(`    starts with https:// : ${supabaseUrl.startsWith('https://')}`)
  console.log(`    ends with / : ${supabaseUrl.endsWith('/')}`)
  console.log(`    contains spaces : ${/\s/.test(supabaseUrl)}`)
  try {
    const host = new URL(supabaseUrl).hostname
    console.log(`    hostname ends with .supabase.co : ${host.endsWith('.supabase.co')}`)
  } catch {
    console.log('    hostname: INVALID URL parse')
  }
}

console.log('\n--- Connection tests ---\n')

let exitCode = 0

// Prisma
console.log('1) Prisma → Supabase Postgres')
if (envStatus('DATABASE_URL') !== 'set' || envStatus('DIRECT_URL') !== 'set') {
  console.log(
    '   SKIP: Add DATABASE_URL and DIRECT_URL from Supabase → Settings → Database → Connection string'
  )
  exitCode = 1
} else {
  const prisma = new PrismaClient()
  try {
    await prisma.$connect()
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    const names = tables.map((t) => t.table_name)
    console.log('   OK: Connected')
    console.log('   Public tables:', names.length ? names.join(', ') : '(none yet — run npm run db:push)')
  } catch (err) {
    console.error('   FAIL:', err.message)
    exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

// Supabase JS
console.log('\n2) Supabase JS (publishable/anon key)')
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseKeyStatus = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ? envStatus('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  : envStatus('NEXT_PUBLIC_SUPABASE_ANON_KEY')

if (envStatus('NEXT_PUBLIC_SUPABASE_URL') !== 'set') {
  console.log('   SKIP: NEXT_PUBLIC_SUPABASE_URL not set')
  exitCode = 1
} else if (supabaseKeyStatus !== 'set' || !supabaseKey) {
  console.log('   SKIP: Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  exitCode = 1
} else {
  const supabase = createClient(supabaseUrl, supabaseKey)
  try {
    const { error } = await supabase.from('users').select('id').limit(1)
    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('does not exist')) {
        console.log('   OK: API reachable (users table not created yet — run npm run db:push)')
      } else if (
        error.code === '42501' ||
        error.message.toLowerCase().includes('permission')
      ) {
        console.log('   OK: API reachable (RLS blocked read — normal until policies exist)')
      } else {
        console.error('   FAIL:', error.message)
        exitCode = 1
      }
    } else {
      console.log('   OK: Connected and queried users table')
    }
  } catch (err) {
    console.error('   FAIL:', err.message)
    exitCode = 1
  }
}

// Service role
console.log('\n3) Supabase JS (service role)')
if (envStatus('SUPABASE_SERVICE_ROLE_KEY') !== 'set') {
  console.log('   SKIP: SUPABASE_SERVICE_ROLE_KEY not set')
} else if (envStatus('NEXT_PUBLIC_SUPABASE_URL') === 'set') {
  const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { error } = await admin.from('users').select('id').limit(1)
  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('does not exist')) {
      console.log('   OK: Service role reachable (users table not created yet)')
    } else {
      console.error('   FAIL:', error.message)
      exitCode = 1
    }
  } else {
    console.log('   OK: Service role connected')
  }
}

console.log('\nDone.')
process.exit(exitCode)
