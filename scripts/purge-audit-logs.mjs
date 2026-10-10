import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env.local')

for (const line of readFileSync(envPath, 'utf8').split('\n')) {
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
  process.env[key] = value
}

const months = Number(process.env.AUDIT_RETENTION_MONTHS || 18)
const dryRun = process.argv.includes('--dry-run')
// --all clears the whole log (pre-launch reset).
const all = process.argv.includes('--all')
const prisma = new PrismaClient()

const cutoff = new Date()
if (all) cutoff.setFullYear(cutoff.getFullYear() + 1)
else cutoff.setMonth(cutoff.getMonth() - months)

const count = await prisma.auditLog.count({
  where: { createdAt: { lt: cutoff } },
})

console.log(
  all
    ? `Audit reset: ${count} row(s) in total will be deleted`
    : `Audit retention: ${count} row(s) older than ${months} months (before ${cutoff.toISOString()})`
)

if (dryRun) {
  console.log('Dry run — no deletes.')
} else if (count > 0) {
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`
    return tx.$executeRaw`DELETE FROM "audit_logs" WHERE "createdAt" < ${cutoff}`
  })
  console.log(`Deleted ${Number(deleted)} audit log row(s).`)
} else {
  console.log('Nothing to delete.')
}

await prisma.$disconnect()
