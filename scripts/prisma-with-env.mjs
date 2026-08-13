import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env.local')

try {
  const raw = readFileSync(envPath, 'utf8')
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
    process.env[key] = value
  }
} catch {
  console.error('Missing .env.local — create it from .env.local.example')
  process.exit(1)
}

// Supabase's direct/session pooler endpoint can occasionally be unavailable
// from local networks. This opt-in keeps normal behavior unchanged while
// allowing migration commands to use the working transaction-pooler URL.
if (process.env.PRISMA_USE_POOLER_FOR_DIRECT === 'true' && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL
}

const args = process.argv.slice(2)
const result = spawnSync('npx', ['prisma', ...args], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: true,
})

process.exit(result.status ?? 1)
