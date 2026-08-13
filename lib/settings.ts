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
  loanMaxAmountKes: 'loan_max_amount_kes',
  loanMinGuarantors: 'loan_min_guarantors',
  loanRequireGuarantorAccept: 'loan_require_guarantor_accept',
  familyAdulthoodAge: 'family_adulthood_age',
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
  [SETTING_KEYS.loanMaxAmountKes]: z.string().regex(/^\d+(\.\d{1,2})?$/).refine((v) => Number(v) > 0),
  [SETTING_KEYS.loanMinGuarantors]: z.string().regex(/^\d+$/).refine((v) => Number(v) >= 0 && Number(v) <= 10),
  [SETTING_KEYS.loanRequireGuarantorAccept]: z.enum(['true', 'false']),
  [SETTING_KEYS.familyAdulthoodAge]: z.string().regex(/^\d+$/).refine((v) => Number(v) >= 13 && Number(v) <= 25),
}

const defaults: Partial<Record<SettingKey, string>> = {
  [SETTING_KEYS.financialApprovalThresholdKes]: '50000',
  [SETTING_KEYS.passwordMinLength]: '8',
  [SETTING_KEYS.passwordRequireMixed]: 'false',
  [SETTING_KEYS.auditRetentionDays]: '365',
  [SETTING_KEYS.brandingSiteName]: 'Alubonets',
  [SETTING_KEYS.brandingPrimaryHex]: '#003366',
  [SETTING_KEYS.loanMaxAmountKes]: '50000',
  [SETTING_KEYS.loanMinGuarantors]: '1',
  [SETTING_KEYS.loanRequireGuarantorAccept]: 'true',
  [SETTING_KEYS.familyAdulthoodAge]: '18',
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
    SETTING_KEYS.loanMaxAmountKes,
    SETTING_KEYS.loanMinGuarantors,
    SETTING_KEYS.loanRequireGuarantorAccept,
  ])
  return {
    maxAmountKes: Number(s[SETTING_KEYS.loanMaxAmountKes] || 50000),
    minGuarantors: Number(s[SETTING_KEYS.loanMinGuarantors] || 1),
    requireGuarantorAccept: s[SETTING_KEYS.loanRequireGuarantorAccept] !== 'false',
  }
}

export async function getBranding() {
  const s = await getSettings([SETTING_KEYS.brandingSiteName, SETTING_KEYS.brandingPrimaryHex])
  return {
    siteName: s[SETTING_KEYS.brandingSiteName] || 'Alubonets',
    primaryHex: s[SETTING_KEYS.brandingPrimaryHex] || '#003366',
  }
}
