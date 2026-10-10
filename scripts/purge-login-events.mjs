import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

// Clears the whole login history (pre-launch reset).
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  let value = trimmed.slice(eq + 1).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  process.env[trimmed.slice(0, eq).trim()] = value
}

const dryRun = process.argv.includes('--dry-run')
const prisma = new PrismaClient()
const count = await prisma.loginEvent.count()
console.log(`Login history: ${count} row(s)`)

if (dryRun) {
  console.log('Dry run — no deletes.')
} else if (count > 0) {
  const { count: deleted } = await prisma.loginEvent.deleteMany({})
  console.log(`Deleted ${deleted} login row(s).`)
} else {
  console.log('Nothing to delete.')
}

await prisma.$disconnect()
