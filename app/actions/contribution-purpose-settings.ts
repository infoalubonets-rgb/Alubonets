'use server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { isSystemCategoryCode } from '@/lib/payment-categories'
import { purposeRuleSchema, PURPOSE_RULE_PREFIX, PURPOSE_OVERRIDE_PREFIX } from '@/lib/contribution-purpose-rules'
import { getPurposeRules } from '@/lib/contribution-purpose-settings'
import { STANDING_SETTING_KEYS } from '@/lib/membership-standing-settings'
import { syncMembershipStanding, recomputeMemberStanding } from '@/lib/membership-standing-sync'

function refresh() {
  for (const tag of ['members', 'contributions', 'app-settings']) revalidateTag(tag)
  for (const path of ['/dashboard/treasurer/settings', '/dashboard/treasurer/finance', '/dashboard/treasurer/ledger', '/contributions', '/directory', '/admin/members']) revalidatePath(path)
}
export async function savePurposeRule(input: unknown, memberId?: string, enabled = true) {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const rule = purposeRuleSchema.parse(input)
  const category = await prisma.transactionCategory.findUniqueOrThrow({ where: { id: rule.categoryId } })
  if (!category.active || isSystemCategoryCode(category.code)) throw new Error('This purpose cannot be configured.')
  if (memberId) {
    z.string().min(1).parse(memberId)
    z.boolean().parse(enabled)
    await prisma.user.findUniqueOrThrow({ where: { id: memberId }, select: { id: true } })
  } else if (rule.scope === 'SELECTED') {
    const count = await prisma.user.count({ where: { id: { in: [...new Set(rule.memberIds)] } } })
    if (count !== new Set(rule.memberIds).size) throw new Error('One or more members no longer exist.')
  }
  const { rules } = await getPurposeRules()
  if (!memberId && rule.memberContribution && rule.scope !== 'NONE') {
    const other = rules.find(r => r.categoryId !== rule.categoryId && r.memberContribution && r.frequency === rule.frequency && r.scope !== 'NONE')
    if (other) throw new Error(`A ${rule.frequency.toLowerCase()} membership purpose is already applied. Edit it, or remove its member application first.`)
  }
  const key = memberId ? `${PURPOSE_OVERRIDE_PREFIX}${memberId}:${rule.categoryId}` : `${PURPOSE_RULE_PREFIX}${rule.categoryId}`
  const value = JSON.stringify(memberId ? { userId: memberId, enabled, rule } : rule)
  const previous = await prisma.appSetting.findUnique({ where: { key } })
  await prisma.$transaction(async tx => {
    await tx.appSetting.upsert({ where: { key }, create: { key, value, updatedBy: actor.id }, update: { value, updatedBy: actor.id } })
    if (memberId && rule.memberContribution && enabled) await tx.user.update({ where: { id: memberId }, data: { contributionPlan: rule.frequency === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY' } })
    if (!memberId) {
      await tx.transactionCategory.update({ where: { id: rule.categoryId }, data: { fixedAmountKes: rule.amountKes, billingKind: rule.memberContribution ? (rule.frequency === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY') : 'NONE' } })
      const oldRule = previous ? purposeRuleSchema.safeParse(JSON.parse(previous.value)) : null
      const old = oldRule?.success ? oldRule.data : null
      const fees = new Map<string, string>()
      if (old?.memberContribution && old.scope === 'ALL') fees.set(old.frequency === 'ANNUAL' ? STANDING_SETTING_KEYS.annualFeeKes : STANDING_SETTING_KEYS.monthlyFeeKes, '0')
      if (rule.memberContribution && rule.scope === 'ALL') fees.set(rule.frequency === 'ANNUAL' ? STANDING_SETTING_KEYS.annualFeeKes : STANDING_SETTING_KEYS.monthlyFeeKes, String(rule.amountKes))
      for (const [feeKey, feeValue] of fees) await tx.appSetting.upsert({ where: { key: feeKey }, create: { key: feeKey, value: feeValue, updatedBy: actor.id }, update: { value: feeValue, updatedBy: actor.id } })
      if (rule.memberContribution && rule.scope === 'SELECTED') await tx.user.updateMany({ where: { id: { in: rule.memberIds } }, data: { contributionPlan: rule.frequency === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY' } })
    }
  })
  await writeAudit({ userId: actor.id, action: memberId ? 'MEMBER_PURPOSE_SETTINGS_UPDATE' : 'CONTRIBUTION_PURPOSE_SETTINGS_UPDATE', entity: memberId ? 'User' : 'TransactionCategory', entityId: memberId || rule.categoryId, oldValue: previous ? JSON.parse(previous.value) : {}, newValue: JSON.parse(value) })
  if (memberId) await recomputeMemberStanding(memberId, actor.id)
  else await syncMembershipStanding()
  refresh()
  return { ok: true as const }
}

export async function resetMemberPurpose(memberId: string, categoryId: string) {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const key = `${PURPOSE_OVERRIDE_PREFIX}${z.string().min(1).parse(memberId)}:${z.string().min(1).parse(categoryId)}`
  const previous = await prisma.appSetting.findUnique({ where: { key } })
  await prisma.appSetting.deleteMany({ where: { key } })
  await writeAudit({ userId: actor.id, action: 'MEMBER_PURPOSE_SETTINGS_RESET', entity: 'User', entityId: memberId, oldValue: previous ? JSON.parse(previous.value) : {}, newValue: { categoryId, inherited: true } })
  await recomputeMemberStanding(memberId, actor.id)
  refresh()
}
