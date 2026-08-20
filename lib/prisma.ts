import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prismaNative: PrismaClient | undefined
}

function databaseUrl() {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined

  try {
    const url = new URL(raw)
    // This app runs as a single long-running Next.js process (next dev /
    // next start), not per-request serverless functions, so every request
    // shares this one pool. It needs to be large enough to cover concurrent
    // dashboard polling (notifications, announcements, payment counts) plus
    // page loads and server actions without queuing on the pool_timeout.
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '15')
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
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaNative = prisma
