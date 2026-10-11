import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prismaNative: PrismaClient | undefined
}

/** Supabase pooler ports: 5432 is session mode (one pooled slot per client), 6543 is transaction mode. */
const SESSION_POOLER_PORT = '5432'
const TRANSACTION_POOLER_PORT = '6543'

function databaseUrl() {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined

  try {
    const url = new URL(raw)
    // Supabase's session pooler gives each client its own slot, and the free plan has only 15.
    // A dev server plus the Vercel instances used them all up, so the live site could not reach
    // the database ("We cannot connect to the service"). The transaction pooler on the same host
    // shares its slots across clients, so the app always uses it. Migrations keep DIRECT_URL.
    if (url.hostname.endsWith('pooler.supabase.com') && url.port === SESSION_POOLER_PORT) {
      url.port = TRANSACTION_POOLER_PORT
    }
    if (url.port === TRANSACTION_POOLER_PORT) url.searchParams.set('pgbouncer', 'true')
    // Vercel runs many instances, each with its own pool, so keep each one small. A local
    // `next dev` / `next start` is one long-running process shared by every request.
    url.searchParams.set('connection_limit', process.env.VERCEL ? '5' : '10')
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20')
    if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '15')
    return url.toString()
  } catch {
    return raw
  }
}

export const prisma =
  globalForPrisma.prismaNative ??
  new PrismaClient({
    datasources: databaseUrl() ? { db: { url: databaseUrl() } } : undefined,
    log: process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaNative = prisma
