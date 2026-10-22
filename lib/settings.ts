import { unstable_cache, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { CONTACT_EMAIL } from '@/lib/constants'

export const SETTING_KEYS = {
  contactDestinationEmail: 'contact_destination_email',
  contactRecipients: 'contact_recipients',
  contactPublicEmail: 'contact_public_email',
  contactPublicPhone: 'contact_public_phone',
  financialApprovalThresholdKes: 'financial_approval_threshold_kes',
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
  welfareMinAmountKes: 'welfare_min_amount_kes',
  welfareMaxAmountKes: 'welfare_max_amount_kes',
} as const

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]

const validators: Record<SettingKey, z.ZodType<string>> = {
  [SETTING_KEYS.contactDestinationEmail]: z.string().max(2000)
    .refine((value) => {
      const emails = parseEmailList(value)
      return emails.length >= 1 && emails.length <= 20 && emails.every((email) => z.string().email().safeParse(email).success)
    }, { message: 'Enter 1 to 20 valid email addresses, separated by commas or new lines.' })
    .transform((value) => parseEmailList(value).join(', ')),
  [SETTING_KEYS.contactRecipients]: z
    .string()
    .max(2000)
    .refine((v) => parseEmailList(v).every((email) => z.string().email().safeParse(email).success), {
      message: 'Enter valid email addresses separated by commas.',
    })
    .transform((v) => parseEmailList(v).join(', ')),
  [SETTING_KEYS.contactPublicEmail]: z.string().email().or(z.literal('')),
  [SETTING_KEYS.contactPublicPhone]: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === '' || /^[+0-9()\-\s]{7,40}$/.test(v), {
      message: 'Enter a valid phone number.',
    }),
  [SETTING_KEYS.financialApprovalThresholdKes]: z.string().regex(/^\d+(\.\d{1,2})?$/),
  // 0 keeps audit logs forever; otherwise at least 90 days so a month's warning always comes first.
  [SETTING_KEYS.auditRetentionDays]: z.string().regex(/^\d+$/).refine((v) => Number(v) === 0 || (Number(v) >= 90 && Number(v) <= 3650)),
  [SETTING_KEYS.brandingSiteName]: z.string().trim().min(2).max(80),
  [SETTING_KEYS.brandingPrimaryHex]: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  [SETTING_KEYS.loanMinAmountKes]: z.string().regex(/^\d{1,6}$/).refine((v) => Number(v) >= 0 && Number(v) <= 999_999),
  [SETTING_KEYS.loanMaxAmountKes]: z.string().regex(/^\d{1,6}$/).refine((v) => Number(v) >= 100 && Number(v) <= 999_999),
  [SETTING_KEYS.loanMinGuarantors]: z.string().regex(/^\d+$/).refine((v) => Number(v) >= 0 && Number(v) <= 10),
  [SETTING_KEYS.loanRequireGuarantorAccept]: z.enum(['true', 'false']),
  [SETTING_KEYS.loanPolicyTitle]: z.string().trim().max(200),
  [SETTING_KEYS.loanPolicyContent]: z.string().trim().max(20_000),
  [SETTING_KEYS.loanPolicyEffectiveDate]: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
  [SETTING_KEYS.welfareMinAmountKes]: z.string().regex(/^\d+(\.\d{1,2})?$/).refine((v) => Number(v) >= 0),
  [SETTING_KEYS.welfareMaxAmountKes]: z.string().regex(/^\d+(\.\d{1,2})?$/).refine((v) => Number(v) > 0),
}

const defaults: Partial<Record<SettingKey, string>> = {
  [SETTING_KEYS.contactPublicEmail]: CONTACT_EMAIL,
  [SETTING_KEYS.contactPublicPhone]: '',
  [SETTING_KEYS.financialApprovalThresholdKes]: '50000',
  [SETTING_KEYS.auditRetentionDays]: '0',
  [SETTING_KEYS.brandingSiteName]: 'Alubonets',
  [SETTING_KEYS.brandingPrimaryHex]: '#003366',
  [SETTING_KEYS.loanMinAmountKes]: '1300',
  [SETTING_KEYS.loanMaxAmountKes]: '50000',
  [SETTING_KEYS.loanMinGuarantors]: '2',
  [SETTING_KEYS.loanRequireGuarantorAccept]: 'true',
  [SETTING_KEYS.loanPolicyTitle]: 'Loan Policy',
  [SETTING_KEYS.welfareMinAmountKes]: '1000',
  [SETTING_KEYS.welfareMaxAmountKes]: '100000',
}

export function parseEmailList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,;\n]/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

export function validateSettingValue(key: SettingKey, value: string): string {
  return validators[key].parse(value.trim())
}

const getCachedSettings = unstable_cache(
  async () => {
    const rows = await prisma.appSetting.findMany({
      where: { key: { in: Object.values(SETTING_KEYS) } },
      select: { key: true, value: true },
    })
    return Object.fromEntries(rows.map((row) => [row.key, row.value]))
  },
  ['app-settings'],
  { revalidate: 300, tags: ['app-settings'] },
)

export async function getSetting(key: SettingKey): Promise<string> {
  const settings = await getCachedSettings()
  return settings[key] ?? defaults[key] ?? ''
}

export async function getSettings(keys: SettingKey[]): Promise<Record<string, string>> {
  const settings = await getCachedSettings()
  const map: Record<string, string> = {}
  for (const key of keys) {
    map[key] = settings[key] ?? defaults[key] ?? ''
  }
  return map
}
export async function setSetting(key: SettingKey, value: string, updatedBy?: string) {
  const parsed = validateSettingValue(key, value)
  const setting = await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: parsed, updatedBy },
    update: { value: parsed, updatedBy },
  })
  revalidateTag('app-settings')
  return setting
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

export async function getPublicContact() {
  const s = await getSettings([
    SETTING_KEYS.contactPublicEmail,
    SETTING_KEYS.contactPublicPhone,
    SETTING_KEYS.contactDestinationEmail,
    SETTING_KEYS.contactRecipients,
  ])
  const email = s[SETTING_KEYS.contactPublicEmail] || CONTACT_EMAIL
  const phone = s[SETTING_KEYS.contactPublicPhone] || ''
  const enquiryEmail = s[SETTING_KEYS.contactDestinationEmail] || email || CONTACT_EMAIL
  const recipients = parseEmailList(s[SETTING_KEYS.contactRecipients] || '')
  return { email, phone, enquiryEmail, recipients }
}

export async function getWelfarePolicy() {
  const settings = await getSettings([SETTING_KEYS.welfareMinAmountKes, SETTING_KEYS.welfareMaxAmountKes])
  return {
    minAmountKes: Number(settings[SETTING_KEYS.welfareMinAmountKes] || 1000),
    maxAmountKes: Number(settings[SETTING_KEYS.welfareMaxAmountKes] || 100000),
  }
}
