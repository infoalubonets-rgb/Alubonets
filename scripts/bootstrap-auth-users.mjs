/**
 * Creates/links Supabase Auth for profiles (Super Admin + local test roles).
 *
 * Required in .env.local (never commit):
 *   SUPER_ADMIN_PASSWORD
 *   SEED_AUTH_PASSWORD
 * Optional:
 *   SUPER_ADMIN_EMAIL — real Super Admin email (also gets SUPER_ADMIN_PASSWORD)
 *
 * Usage: npm run db:bootstrap-auth
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(root, '.env.local'), 'utf8')
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
  } catch {
    // host may inject env
  }
}

loadEnvLocal()

const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || null
const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD?.trim()
const defaultPassword = process.env.SEED_AUTH_PASSWORD?.trim()

if (!superAdminPassword || !defaultPassword) {
  console.error(
    'Missing SUPER_ADMIN_PASSWORD and/or SEED_AUTH_PASSWORD in .env.local.',
  )
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const prisma = new PrismaClient()

const users = await prisma.user.findMany()
for (const user of users) {
  if (
    user.email.endsWith('@alubonets.local') ||
    user.familyRegistrationState === 'RECORD_ONLY'
  ) {
    console.log(`skip record-only ${user.email}`)
    continue
  }

  const isSuper =
    user.isSuperAdmin ||
    (superAdminEmail != null && user.email.toLowerCase() === superAdminEmail) ||
    user.email.toLowerCase() === 'superadmin@alubonets.com'
  const password = isSuper ? superAdminPassword : defaultPassword

  const appMetadata = {
    role: user.role,
    status: user.status,
    isSuperAdmin: user.isSuperAdmin,
    dashboardAccess: user.dashboardAccess,
    isPrincipal: user.isPrincipal,
    dbUserId: user.id,
    fullName: user.fullName,
  }

  if (user.authUserId) {
    const { error } = await admin.auth.admin.updateUserById(user.authUserId, {
      email: user.email,
      password,
      email_confirm: true,
      app_metadata: appMetadata,
    })
    if (error) {
      console.error(`FAIL update ${user.email}:`, error.message)
      continue
    }
    console.log(`updated ${user.email}`)
    continue
  }

  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existing = listed?.users?.find((u) => u.email?.toLowerCase() === user.email.toLowerCase())

  let authId = existing?.id
  if (!authId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
      app_metadata: appMetadata,
    })
    if (error || !data.user) {
      console.error(`FAIL ${user.email}:`, error?.message)
      continue
    }
    authId = data.user.id
  } else {
    const { error } = await admin.auth.admin.updateUserById(authId, {
      email: user.email,
      app_metadata: appMetadata,
      password,
      email_confirm: true,
    })
    if (error) {
      console.error(`FAIL update ${user.email}:`, error.message)
      continue
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { authUserId: authId },
  })
  console.log(`OK ${user.email} → ${authId}`)
}

console.log('\nBootstrap complete.')
console.log('Test autofill: focus email on /login or /admin/login')
console.log('(Passwords are not printed — use your .env.local values.)')

await prisma.$disconnect()
