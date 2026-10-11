import { z } from 'zod'
import { todayRange, appTodayInputValue } from './dates'

export const purposeRuleSchema = z.object({
  categoryId: z.string().min(1), amountKes: z.number().finite().min(0).max(999999),
  frequency: z.enum(['ONCE', 'MONTHLY', 'ANNUAL']),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v }, 'Choose a valid deadline'),
  graceDays: z.number().int().min(0).max(365), memberContribution: z.boolean(),
  scope: z.enum(['NONE', 'ALL', 'SELECTED']), memberIds: z.array(z.string().min(1)).max(10000),
}).refine(r => !r.memberContribution || r.frequency !== 'ONCE', 'Member contributions must be monthly or annual')
  .refine(r => r.scope !== 'SELECTED' || r.memberIds.length > 0, 'Select at least one member')
export type PurposeRule = z.infer<typeof purposeRuleSchema>
export type PurposeOverride = { userId: string; rule: PurposeRule; enabled: boolean }
export const PURPOSE_RULE_PREFIX = 'finance_purpose:rule:'
export const PURPOSE_OVERRIDE_PREFIX = 'finance_purpose:member:'

export function appliesToMember(rule: PurposeRule, userId: string) {
  return rule.scope === 'ALL' || (rule.scope === 'SELECTED' && rule.memberIds.includes(userId))
}

export function memberPurposeRules(rules: PurposeRule[], overrides: PurposeOverride[], userId: string) {
  const assigned = rules.filter(r => appliesToMember(r, userId)).map(rule => ({ rule, enabled: true }))
  for (const override of overrides.filter(o => o.userId === userId)) {
    const index = assigned.findIndex(a => a.rule.categoryId === override.rule.categoryId)
    if (index >= 0) assigned[index] = override
    else assigned.push(override)
  }
  return assigned
}

/** Recurrences retain the chosen day; short months and leap years clamp to their last day. */
export function purposeDeadline(rule: Pick<PurposeRule, 'deadline' | 'frequency'>, offset: number) {
  const anchor = new Date(`${rule.deadline}T00:00:00Z`)
  const year = anchor.getUTCFullYear() + (rule.frequency === 'ANNUAL' ? offset : 0)
  const month = anchor.getUTCMonth() + (rule.frequency === 'MONTHLY' ? offset : 0)
  const first = new Date(Date.UTC(year, month, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(anchor.getUTCDate(), last)))
}

export function purposeBalance(rule: PurposeRule, joinedAt: Date, payments: { amount: number; paidAt: Date }[], now = new Date()) {
  let overduePeriods = 0
  let nextDeadline: Date | null = null
  for (let offset = 0; ; offset++) {
    const due = purposeDeadline(rule, offset)
    const cutoff = new Date(todayRange(due).end.getTime() + 1 + rule.graceDays * 86400000)
    if (due >= new Date(`${appTodayInputValue(joinedAt)}T00:00:00Z`)) {
      if (now < cutoff) { nextDeadline = due; break }
      overduePeriods++
    }
    if (rule.frequency === 'ONCE') break
  }
  // Payments recorded before the first deadline can prepay this obligation.
  const anchor = new Date(`${rule.deadline}T00:00:00Z`)
  const cycleStart = rule.frequency === 'MONTHLY' ? new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)) : rule.frequency === 'ANNUAL' ? new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1)) : joinedAt
  const cycleInstant = todayRange(cycleStart).start
  const since = joinedAt > cycleInstant ? joinedAt : cycleInstant
  const paid = payments.filter(p => p.paidAt >= since && p.paidAt <= now).reduce((sum, p) => sum + p.amount, 0)
  const required = overduePeriods * rule.amountKes
  return { overduePeriods, required, paid, outstanding: Math.max(0, Math.round((required - paid) * 100) / 100), nextDeadline }
}
