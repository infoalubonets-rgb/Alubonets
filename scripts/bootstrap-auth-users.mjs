/**
 * Creates Supabase Auth users for seeded Prisma profiles and links authUserId.
 *
 * Super admin password (default): SuperAdmin@2026!
 * Other seeded accounts (default): ChangeMe123!
 *
 * Overrides:
 *   SUPER_ADMIN_PASSWORD
 *   SEED_AUTH_PASSWORD
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
}

loadEnvLocal()

const SUPER_ADMIN_EMAIL = 'superadmin@alubonets.com'
const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@2026!'
const defaultPassword = process.env.SEED_AUTH_PASSWORD || 'ChangeMe123!'

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

  const password =
    user.email.toLowerCase() === SUPER_ADMIN_EMAIL ? superAdminPassword : defaultPassword

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
    await admin.auth.admin.updateUserById(user.authUserId, {
      password,
      app_metadata: appMetadata,
    })
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
    await admin.auth.admin.updateUserById(authId, {
      app_metadata: appMetadata,
      password,
    })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { authUserId: authId },
  })
  console.log(`OK ${user.email} → ${authId}`)
}

console.log('\n--- Seeded Auth credentials ---')
console.log(`Super Admin: ${SUPER_ADMIN_EMAIL}`)
console.log(`Password:    ${superAdminPassword}`)
console.log(`Other roles: ${defaultPassword}`)
console.log('Login at:    /admin/login  (no register)')
console.log('Public reg:  homepage Auth modal only')

await prisma.$disconnect()
