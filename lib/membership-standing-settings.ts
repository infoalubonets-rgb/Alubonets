import { prisma } from '@/lib/prisma'
import { ANNUAL_DUE_DATE_PATTERN, DEFAULT_STANDING_SETTINGS, type StandingSettings } from '@/lib/membership-standing'

export const STANDING_SETTING_KEYS = {
  monthlyFeeKes: 'standing_monthly_fee_kes',
  monthlyGraceDays: 'standing_monthly_grace_days',
  annualFeeKes: 'standing_annual_fee_kes',
  annualRenewalDays: 'standing_annual_renewal_days',
  annualDueDate: 'standing_annual_due_date',
  effectiveFrom: 'standing_effective_from',
} as const

function firstOfThisMonth() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function numberOr(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : fallback
}

export async function getStandingSettings(): Promise<StandingSettings> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(STANDING_SETTING_KEYS) } },
  })
  const map = new Map(rows.map((row) => [row.key, row.value]))
  const effective = map.get(STANDING_SETTING_KEYS.effectiveFrom)
  const effectiveDate = effective ? new Date(effective) : null
  const dueDate = map.get(STANDING_SETTING_KEYS.annualDueDate) ?? ''
  return {
    monthlyFeeKes: numberOr(map.get(STANDING_SETTING_KEYS.monthlyFeeKes), DEFAULT_STANDING_SETTINGS.monthlyFeeKes),
    monthlyGraceDays: numberOr(map.get(STANDING_SETTING_KEYS.monthlyGraceDays), DEFAULT_STANDING_SETTINGS.monthlyGraceDays),
    annualFeeKes: numberOr(map.get(STANDING_SETTING_KEYS.annualFeeKes), DEFAULT_STANDING_SETTINGS.annualFeeKes),
    annualRenewalDays: numberOr(map.get(STANDING_SETTING_KEYS.annualRenewalDays), DEFAULT_STANDING_SETTINGS.annualRenewalDays),
    annualDueDate: ANNUAL_DUE_DATE_PATTERN.test(dueDate) ? dueDate : null,
    effectiveFrom: effectiveDate && !Number.isNaN(effectiveDate.getTime()) ? effectiveDate : firstOfThisMonth(),
  }
}

export async function saveStandingSettings(settings: StandingSettings, updatedBy: string) {
  const values: Record<string, string> = {
    [STANDING_SETTING_KEYS.monthlyFeeKes]: String(settings.monthlyFeeKes),
    [STANDING_SETTING_KEYS.monthlyGraceDays]: String(settings.monthlyGraceDays),
    [STANDING_SETTING_KEYS.annualFeeKes]: String(settings.annualFeeKes),
    [STANDING_SETTING_KEYS.annualRenewalDays]: String(settings.annualRenewalDays),
    [STANDING_SETTING_KEYS.annualDueDate]: settings.annualDueDate ?? '',
    [STANDING_SETTING_KEYS.effectiveFrom]: settings.effectiveFrom.toISOString(),
  }
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value, updatedBy },
        update: { value, updatedBy },
      }),
    ),
  )
}
