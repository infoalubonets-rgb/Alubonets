import { prisma } from '@/lib/prisma'
import { purposeRuleSchema, PURPOSE_RULE_PREFIX, PURPOSE_OVERRIDE_PREFIX, type PurposeRule, type PurposeOverride } from './contribution-purpose-rules'

export async function getPurposeRules() {
  const rows = await prisma.appSetting.findMany({ where: { OR: [{ key: { startsWith: PURPOSE_RULE_PREFIX } }, { key: { startsWith: PURPOSE_OVERRIDE_PREFIX } }] } })
  const rules: PurposeRule[] = []
  const overrides: PurposeOverride[] = []
  for (const row of rows) {
    try {
      const value = JSON.parse(row.value)
      if (row.key.startsWith(PURPOSE_RULE_PREFIX)) rules.push(purposeRuleSchema.parse(value))
      else { const rule = purposeRuleSchema.parse(value.rule); if (typeof value.userId === 'string' && typeof value.enabled === 'boolean') overrides.push({ userId: value.userId, enabled: value.enabled, rule }) }
    } catch { /* Ignore malformed legacy configuration. */ }
  }
  return { rules, overrides }
}
