/**
 * Ensures principal@alubonets.com exists without wiping the database.
 * Usage: node scripts/ensure-principal.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
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

const prisma = new PrismaClient()
const principal = await prisma.user.upsert({
  where: { email: 'principal@alubonets.com' },
  create: {
    email: 'principal@alubonets.com',
    fullName: 'Principal Otieno',
    phone: '+254700000088',
    role: 'MEMBER',
    status: 'ACTIVE',
    isPrincipal: true,
    familyRegistrationState: 'STANDARD',
  },
  update: {
    fullName: 'Principal Otieno',
    status: 'ACTIVE',
    isPrincipal: true,
    principalMemberId: null,
    familyRegistrationState: 'STANDARD',
  },
})
console.log('OK', principal.email, 'isPrincipal=', principal.isPrincipal)
await prisma.$disconnect()
