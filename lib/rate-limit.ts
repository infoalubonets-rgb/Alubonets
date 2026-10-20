import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'

/**
 * Counts an attempt and throws once `limit` is exceeded within `windowMinutes`; the key then stays
 * blocked for one more window. The count is a single atomic upsert, so many parallel requests
 * cannot all read the same old count and slip past the limit.
 */
export async function enforceRateLimit(key: string, limit: number, windowMinutes: number) {
  const now = new Date()
  const windowMs = windowMinutes * 60_000
  const windowCutoff = new Date(now.getTime() - windowMs)
  const blockUntil = new Date(now.getTime() + windowMs)

  const [row] = await prisma.$queryRaw<Array<{ attempts: number; blockedUntil: Date | null }>>`
    INSERT INTO "rate_limits" ("id", "key", "attempts", "windowStart", "updatedAt")
    VALUES (${randomUUID()}, ${key}, 1, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE
        WHEN "rate_limits"."blockedUntil" > ${now} THEN "rate_limits"."attempts"
        WHEN "rate_limits"."windowStart" <= ${windowCutoff} THEN 1
        ELSE "rate_limits"."attempts" + 1 END,
      "windowStart" = CASE
        WHEN "rate_limits"."blockedUntil" > ${now} THEN "rate_limits"."windowStart"
        WHEN "rate_limits"."windowStart" <= ${windowCutoff} THEN ${now}
        ELSE "rate_limits"."windowStart" END,
      "blockedUntil" = CASE
        WHEN "rate_limits"."blockedUntil" > ${now} THEN "rate_limits"."blockedUntil"
        WHEN "rate_limits"."windowStart" <= ${windowCutoff} THEN NULL
        WHEN "rate_limits"."attempts" + 1 > ${limit} THEN ${blockUntil}
        ELSE NULL END,
      "updatedAt" = ${now}
    RETURNING "attempts", "blockedUntil"
  `
  if (row?.blockedUntil && row.blockedUntil > now) {
    throw new Error('Too many attempts. Please wait and try again.')
  }
}

export async function clearRateLimit(key: string) {
  await prisma.rateLimit.deleteMany({ where: { key } })
}
