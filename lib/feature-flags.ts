import { prisma } from '@/lib/prisma'

export const FEATURE_FLAGS = {
  loansEnabled: 'loans_enabled',
} as const

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({ where: { key } })
  return Boolean(row?.enabled)
}

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const rows = await prisma.featureFlag.findMany()
  const map: Record<string, boolean> = { [FEATURE_FLAGS.loansEnabled]: false }
  for (const row of rows) map[row.key] = row.enabled
  return map
}

export async function setFeatureFlag(key: FeatureFlagKey, enabled: boolean, updatedBy?: string) {
  return prisma.featureFlag.upsert({
    where: { key },
    create: { key, enabled, updatedBy },
    update: { enabled, updatedBy },
  })
}

export async function requireLoansEnabled() {
  const on = await isFeatureEnabled(FEATURE_FLAGS.loansEnabled)
  if (!on) throw new Error('Loans module is disabled.')
}
