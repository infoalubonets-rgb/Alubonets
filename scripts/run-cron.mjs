/**
 * Local / ops helper: run a cron route with CRON_SECRET from .env.local
 *
 * Usage:
 *   npm run cron:maintenance
 *   npm run cron:purge-audit
 *   node scripts/run-cron.mjs stage4-maintenance
 *   node scripts/run-cron.mjs purge-audit --url https://your-site.netlify.app
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const job = process.argv[2]
const urlFlagIndex = process.argv.indexOf('--url')
const baseFromFlag = urlFlagIndex >= 0 ? process.argv[urlFlagIndex + 1] : null

const jobs = {
  'stage4-maintenance': '/api/cron/stage4-maintenance',
  maintenance: '/api/cron/stage4-maintenance',
  'purge-audit': '/api/cron/purge-audit',
  purge: '/api/cron/purge-audit',
}

const path = jobs[job]
if (!path) {
  console.error('Usage: node scripts/run-cron.mjs <stage4-maintenance|purge-audit> [--url https://...]')
  process.exit(1)
}

const secret = process.env.CRON_SECRET?.trim()
if (!secret || secret === 'change-me-to-a-long-random-string') {
  console.error('Set a real CRON_SECRET in .env.local first.')
  process.exit(1)
}

const base = (
  baseFromFlag ||
  process.env.CRON_BASE_URL ||
  // Local npm scripts should hit the dev server, not production NEXT_PUBLIC_APP_URL
  'http://localhost:3001'
).replace(/\/$/, '')

const url = `${base}${path}`
console.log(`Calling ${path} …`)

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
})
const text = await res.text()
let body
try {
  body = JSON.parse(text)
} catch {
  body = text
}

if (!res.ok) {
  console.error(`FAILED ${res.status}`, body)
  process.exit(1)
}

console.log('OK', body)
