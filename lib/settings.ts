import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export const SETTING_KEYS = {
  contactDestinationEmail: 'contact_destination_email',
  financialApprovalThresholdKes: 'financial_approval_threshold_kes',
  passwordMinLength: 'password_min_length',
  passwordRequireMixed: 'password_require_mixed',
  auditRetentionDays: 'audit_retention_days',
  brandingSiteName: 'branding_site_name',
  brandingPrimaryHex: 'branding_primary_hex',
  loanMinAmountKes: 'loan_min_amount_kes',
  loanMaxAmountKes: 'loan_max_amount_kes',
  loanMinGuarantors: 'loan_min_guarantors',
  loanRequireGuarantorAccept: 'loan_require_guarantor_accept',
  loanPolicyTitle: 'loan_policy_title',
  loanPolicyContent: 'loan_policy_content',
  loanPolicyEffectiveDate: 'loan_policy_effective_date',
  familyAdulthoodAge: 'family_adulthood_age',
  welfareMinAmountKes: 'welfare_min_amount_kes',
  welfareMaxAmountKes: 'welfare_max_amount_kes',
} as const

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]

const validators: Record<SettingKey, z.ZodType<string>> = {
  [SETTING_KEYS.contactDestinationEmail]: z.string().email().or(z.literal('')),
  [SETTING_KEYS.financialApprovalThresholdKes]: z.string().regex(/^\d+(\.\d{1,2})?$/),
  [SETTING_KEYS.passwordMinLength]: z.string().regex(/^\d+$/).refine((v) => Number(v) >= 6 && Number(v) <= 128),
  [SETTING_KEYS.passwordRequireMixed]: z.enum(['true', 'false']),
  [SETTING_KEYS.auditRetentionDays]: z.string().regex(/^\d+$/).refine((v) => Number(v) >= 30 && Number(v) <= 3650),
  [SETTING_KEYS.brandingSiteName]: z.string().trim().min(2).max(80),
  [SETTING_KEYS.brandingPrimaryHex]: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  [SETTING_KEYS.loanMinAmountKes]: z.string().regex(/^\d{1,6}$/).refine((v) => Number(v) >= 0 && Number(v) <= 999_999),
  [SETTING_KEYS.loanMaxAmountKes]: z.string().regex(/^\d{1,6}$/).refine((v) => Number(v) >= 100 && Number(v) <= 999_999),
  [SETTING_KEYS.loanMinGuarantors]: z.string().regex(/^\d+$/).refine((v) => Number(v) >= 0 && Number(v) <= 10),
  [SETTING_KEYS.loanRequireGuarantorAccept]: z.enum(['true', 'false']),
  [SETTING_KEYS.loanPolicyTitle]: z.string().trim().max(200),
  [SETTING_KEYS.loanPolicyContent]: z.string().trim().max(20_000),
  [SETTING_KEYS.loanPolicyEffectiveDate]: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
  [SETTING_KEYS.familyAdulthoodAge]: z.string().regex(/^\d+$/).refine((v) => Number(v) >= 13 && Number(v) <= 25),
  [SETTING_KEYS.welfareMinAmountKes]: z.string().regex(/^\d+(\.\d{1,2})?$/).refine((v) => Number(v) >= 0),
  [SETTING_KEYS.welfareMaxAmountKes]: z.string().regex(/^\d+(\.\d{1,2})?$/).refine((v) => Number(v) > 0),
}

const defaults: Partial<Record<SettingKey, string>> = {
  [SETTING_KEYS.financialApprovalThresholdKes]: '50000',
  [SETTING_KEYS.passwordMinLength]: '8',
  [SETTING_KEYS.passwordRequireMixed]: 'false',
  [SETTING_KEYS.auditRetentionDays]: '365',
  [SETTING_KEYS.brandingSiteName]: 'Alubonets',
  [SETTING_KEYS.brandingPrimaryHex]: '#003366',
  [SETTING_KEYS.loanMinAmountKes]: '1300',
  [SETTING_KEYS.loanMaxAmountKes]: '50000',
  [SETTING_KEYS.loanMinGuarantors]: '2',
  [SETTING_KEYS.loanRequireGuarantorAccept]: 'true',
  [SETTING_KEYS.loanPolicyTitle]: 'Loan Policy',
  [SETTING_KEYS.familyAdulthoodAge]: '18',
  [SETTING_KEYS.welfareMinAmountKes]: '1000',
  [SETTING_KEYS.welfareMaxAmountKes]: '100000',
}

export function validateSettingValue(key: SettingKey, value: string): string {
  return validators[key].parse(value.trim())
}

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return row?.value ?? defaults[key] ?? ''
}

export async function getSettings(keys: SettingKey[]): Promise<Record<string, string>> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } })
  const map: Record<string, string> = {}
  for (const key of keys) {
    map[key] = rows.find((r) => r.key === key)?.value ?? defaults[key] ?? ''
  }
  return map
}

export async function setSetting(key: SettingKey, value: string, updatedBy?: string) {
  const parsed = validateSettingValue(key, value)
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value: parsed, updatedBy },
    update: { value: parsed, updatedBy },
  })
}

export async function getLoanPolicy() {
  const s = await getSettings([
    SETTING_KEYS.loanMinAmountKes,
    SETTING_KEYS.loanMaxAmountKes,
    SETTING_KEYS.loanMinGuarantors,
    SETTING_KEYS.loanRequireGuarantorAccept,
  ])
  const maxAmountKes = Math.min(999_999, Math.max(100, Number(s[SETTING_KEYS.loanMaxAmountKes] || 50000)))
  const minAmountKes = Math.min(maxAmountKes, Math.max(0, Number(s[SETTING_KEYS.loanMinAmountKes] || 1300)))
  return {
    minAmountKes,
    maxAmountKes,
    minGuarantors: 2,
    requireGuarantorAccept: s[SETTING_KEYS.loanRequireGuarantorAccept] !== 'false',
  }
}

export async function getLoanPolicyDocument() {
  const s = await getSettings([
    SETTING_KEYS.loanPolicyTitle,
    SETTING_KEYS.loanPolicyContent,
    SETTING_KEYS.loanPolicyEffectiveDate,
  ])
  return {
    title: s[SETTING_KEYS.loanPolicyTitle] || 'Loan Policy',
    content: s[SETTING_KEYS.loanPolicyContent] || '',
    effectiveDate: s[SETTING_KEYS.loanPolicyEffectiveDate] || '',
  }
}

export async function getBranding() {
  const s = await getSettings([SETTING_KEYS.brandingSiteName, SETTING_KEYS.brandingPrimaryHex])
  return {
    siteName: s[SETTING_KEYS.brandingSiteName] || 'Alubonets',
    primaryHex: s[SETTING_KEYS.brandingPrimaryHex] || '#003366',
  }
}

export async function getWelfarePolicy() {
  const settings = await getSettings([SETTING_KEYS.welfareMinAmountKes, SETTING_KEYS.welfareMaxAmountKes])
  return {
    minAmountKes: Number(settings[SETTING_KEYS.welfareMinAmountKes] || 1000),
    maxAmountKes: Number(settings[SETTING_KEYS.welfareMaxAmountKes] || 100000),
  }
}
