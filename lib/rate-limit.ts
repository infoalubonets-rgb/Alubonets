import { prisma } from '@/lib/prisma'

export async function enforceRateLimit(key: string, limit: number, windowMinutes: number) {
  const now = new Date()
  const windowMs = windowMinutes * 60_000
  const existing = await prisma.rateLimit.findUnique({ where: { key } })

  if (existing?.blockedUntil && existing.blockedUntil > now) {
    throw new Error('Too many attempts. Please wait and try again.')
  }

  if (!existing || now.getTime() - existing.windowStart.getTime() >= windowMs) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, attempts: 1, windowStart: now },
      update: { attempts: 1, windowStart: now, blockedUntil: null },
    })
    return
  }

  const attempts = existing.attempts + 1
  const blockedUntil = attempts > limit ? new Date(now.getTime() + windowMs) : null
  // Upsert: the row can be cleared (successful login, purge) between the read above and this write.
  await prisma.rateLimit.upsert({
    where: { key },
    create: { key, attempts: 1, windowStart: now },
    update: { attempts, blockedUntil },
  })
  if (attempts > limit) throw new Error('Too many attempts. Please wait and try again.')
}

export async function clearRateLimit(key: string) {
  await prisma.rateLimit.deleteMany({ where: { key } })
}
