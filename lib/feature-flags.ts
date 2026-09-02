import { prisma } from '@/lib/prisma'

export const FEATURE_FLAGS = {
  loansEnabled: 'loans_enabled',
  welfareEnabled: 'welfare_enabled',
} as const

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]

// Welfare pre-existed feature flags and shipped always-on, so it defaults to
// enabled until an admin explicitly flips it off; loans is opt-in.
const DEFAULT_ENABLED: Partial<Record<FeatureFlagKey, boolean>> = {
  [FEATURE_FLAGS.welfareEnabled]: true,
}

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({ where: { key } })
  if (row) return row.enabled
  return DEFAULT_ENABLED[key] ?? false
}

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const rows = await prisma.featureFlag.findMany()
  const map: Record<string, boolean> = {
    [FEATURE_FLAGS.loansEnabled]: DEFAULT_ENABLED[FEATURE_FLAGS.loansEnabled] ?? false,
    [FEATURE_FLAGS.welfareEnabled]: DEFAULT_ENABLED[FEATURE_FLAGS.welfareEnabled] ?? false,
  }
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

export async function requireWelfareEnabled() {
  const on = await isFeatureEnabled(FEATURE_FLAGS.welfareEnabled)
  if (!on) throw new Error('Welfare module is disabled.')
}
