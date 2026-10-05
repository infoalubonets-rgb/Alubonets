'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveRole, requireAdmin } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { FEATURE_FLAGS, setFeatureFlag } from '@/lib/feature-flags'
import { SETTING_KEYS, setSetting, validateSettingValue, type SettingKey } from '@/lib/settings'
import { isSystemCategoryCode, uniqueCategoryCode } from '@/lib/payment-categories'
import { DISABLED_ROLES_SETTING, DISABLED_ROLES_TAG, parseDisabledRoles } from '@/lib/disabled-roles'

const CATEGORY_NAME_PATTERN = /^[A-Za-z0-9 ()&/,.'-]+$/

function refreshSettings() {
  revalidateTag('app-settings')
  revalidatePath('/admin/settings')
  revalidatePath('/admin')
  revalidatePath('/admin/announcements')
  revalidatePath('/contact')
  revalidatePath('/')
  revalidatePath('/dashboard/member')
  revalidatePath('/dashboard/treasurer')
  revalidatePath('/dashboard/executive')
}

/** Narrower than refreshSettings(): only the pages that actually read transaction categories. */
function refreshCategories() {
  revalidatePath('/admin/settings')
  revalidatePath('/admin/finance')
  revalidatePath('/financial-reports')
  revalidatePath('/dashboard/treasurer/ledger')
  revalidatePath('/dashboard/treasurer/contributions')
}

export async function updateDirectoryFullAccessRoles(formData: FormData) {
  const actor = await requireAdmin()
  const roles = formData
    .getAll('roles')
    .map(String)
    .map((value) => value.trim().toUpperCase())
    .filter((value) =>
      ['EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'AUDITOR'].includes(value),
    )
  const value = roles.join(',')
  await prisma.appSetting.upsert({
    where: { key: 'directory_full_access_roles' },
    create: { key: 'directory_full_access_roles', value, updatedBy: actor.id },
    update: { value, updatedBy: actor.id },
  })
  await writeAudit({
    userId: actor.id,
    action: 'DIRECTORY_FULL_ACCESS_UPDATE',
    entity: 'AppSetting',
    entityId: 'directory_full_access_roles',
    newValue: { roles },
  })
  revalidatePath('/admin/settings')
  revalidatePath('/directory')
}

const LOCKED_SETTING_KEYS: SettingKey[] = [SETTING_KEYS.brandingSiteName, SETTING_KEYS.brandingPrimaryHex]

export async function updateAppSetting(formData: FormData) {
  const actor = await requireAdmin()
  const key = z.string().min(1).parse(formData.get('key')) as SettingKey
  if (!Object.values(SETTING_KEYS).includes(key)) throw new Error('Unknown setting key.')
  if (LOCKED_SETTING_KEYS.includes(key)) throw new Error('Branding settings cannot be changed.')
  const value = String(formData.get('value') ?? '')
  try {
    const row = await setSetting(key, value, actor.id)
    await writeAudit({
      userId: actor.id,
      action: 'APP_SETTING_UPDATE',
      entity: 'AppSetting',
      entityId: key,
      newValue: { value: row.value },
    })
    refreshSettings()
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.issues[0]?.message || 'Invalid setting value.')
    }
    throw error
  }
}

export async function updateContactFinanceSettings(input: {
  publicEmail: string
  publicPhone: string
  enquiryEmail: string
  recipients?: string
  approvalThreshold: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireAdmin()
    const recipients = validateSettingValue(SETTING_KEYS.contactRecipients, input.recipients ?? '')
    const data = z
      .object({
        publicEmail: z.string().trim().email('Enter a valid footer contact email.'),
        publicPhone: z
          .string()
          .trim()
          .max(40)
          .refine((v) => v === '' || /^[+0-9()\-\s]{7,40}$/.test(v), {
            message: 'Enter a valid phone number, or leave it blank.',
          }),
        enquiryEmail: z.string().trim().email('Enter a valid enquiry forwarding email.'),
        approvalThreshold: z
          .string()
          .trim()
          .regex(/^\d+(\.\d{1,2})?$/, 'Approval threshold must be a number in KES.'),
      })
      .parse(input)

    await prisma.$transaction([
      prisma.appSetting.upsert({
        where: { key: SETTING_KEYS.contactPublicEmail },
        create: { key: SETTING_KEYS.contactPublicEmail, value: data.publicEmail, updatedBy: actor.id },
        update: { value: data.publicEmail, updatedBy: actor.id },
      }),
      prisma.appSetting.upsert({
        where: { key: SETTING_KEYS.contactPublicPhone },
        create: { key: SETTING_KEYS.contactPublicPhone, value: data.publicPhone, updatedBy: actor.id },
        update: { value: data.publicPhone, updatedBy: actor.id },
      }),
      prisma.appSetting.upsert({
        where: { key: SETTING_KEYS.contactDestinationEmail },
        create: { key: SETTING_KEYS.contactDestinationEmail, value: data.enquiryEmail, updatedBy: actor.id },
        update: { value: data.enquiryEmail, updatedBy: actor.id },
      }),
      prisma.appSetting.upsert({
        where: { key: SETTING_KEYS.contactRecipients },
        create: { key: SETTING_KEYS.contactRecipients, value: recipients, updatedBy: actor.id },
        update: { value: recipients, updatedBy: actor.id },
      }),
      prisma.appSetting.upsert({
        where: { key: SETTING_KEYS.financialApprovalThresholdKes },
        create: {
          key: SETTING_KEYS.financialApprovalThresholdKes,
          value: data.approvalThreshold,
          updatedBy: actor.id,
        },
        update: { value: data.approvalThreshold, updatedBy: actor.id },
      }),
    ])

    await writeAudit({
      userId: actor.id,
      action: 'CONTACT_FINANCE_SETTINGS_UPDATE',
      entity: 'AppSetting',
      entityId: 'contact_finance',
      newValue: { ...data, recipients },
    })
    revalidateTag('app-settings')

    // Avoid revalidating /admin/settings here — it remounts the modal and can strand the Save UI.
    revalidatePath('/admin/announcements')
    revalidatePath('/contact')
    revalidatePath('/')

    return { ok: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message || 'Invalid setting value.' }
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save settings. Try again.',
    }
  }
}

export async function updateWelfareAmountLimits(formData: FormData) {
  const actor = await requireAdmin()
  const limits = z.object({
    min: z.coerce.number().min(0),
    max: z.coerce.number().positive(),
  }).refine((value) => value.max >= value.min, {
    message: 'Maximum welfare amount must be greater than or equal to the minimum.',
  }).parse({ min: formData.get('min'), max: formData.get('max') })
  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: SETTING_KEYS.welfareMinAmountKes },
      create: { key: SETTING_KEYS.welfareMinAmountKes, value: String(limits.min), updatedBy: actor.id },
      update: { value: String(limits.min), updatedBy: actor.id },
    }),
    prisma.appSetting.upsert({
      where: { key: SETTING_KEYS.welfareMaxAmountKes },
      create: { key: SETTING_KEYS.welfareMaxAmountKes, value: String(limits.max), updatedBy: actor.id },
      update: { value: String(limits.max), updatedBy: actor.id },
    }),
  ])
  await writeAudit({
    userId: actor.id,
    action: 'WELFARE_LIMITS_UPDATE',
    entity: 'AppSetting',
    entityId: 'welfare_amount_limits',
    newValue: limits,
  })
  refreshSettings()
  revalidatePath('/dashboard/member/welfare')
}

export async function updateLoanAmountLimits(formData: FormData) {
  const actor = await requireAdmin()
  const limits = z.object({
    min: z.coerce.number().min(0),
    max: z.coerce.number().min(100).max(999_999),
  }).refine((value) => value.max >= value.min, {
    message: 'Maximum loan amount must be greater than or equal to the minimum.',
  }).parse({ min: formData.get('min'), max: formData.get('max') })
  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: SETTING_KEYS.loanMinAmountKes },
      create: { key: SETTING_KEYS.loanMinAmountKes, value: String(limits.min), updatedBy: actor.id },
      update: { value: String(limits.min), updatedBy: actor.id },
    }),
    prisma.appSetting.upsert({
      where: { key: SETTING_KEYS.loanMaxAmountKes },
      create: { key: SETTING_KEYS.loanMaxAmountKes, value: String(limits.max), updatedBy: actor.id },
      update: { value: String(limits.max), updatedBy: actor.id },
    }),
  ])
  await writeAudit({
    userId: actor.id,
    action: 'LOAN_LIMITS_UPDATE',
    entity: 'AppSetting',
    entityId: 'loan_amount_limits',
    newValue: limits,
  })
  refreshSettings()
  revalidatePath('/dashboard/member/loans')
}

export async function updateLoanPolicy(formData: FormData) {
  const actor = await requireAdmin()
  const data = z.object({
    title: z.string().trim().min(2).max(200),
    content: z.string().trim().max(20_000),
    effectiveDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
  }).parse({
    title: formData.get('title'),
    content: formData.get('content'),
    effectiveDate: formData.get('effectiveDate') || '',
  })
  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: SETTING_KEYS.loanPolicyTitle },
      create: { key: SETTING_KEYS.loanPolicyTitle, value: data.title, updatedBy: actor.id },
      update: { value: data.title, updatedBy: actor.id },
    }),
    prisma.appSetting.upsert({
      where: { key: SETTING_KEYS.loanPolicyContent },
      create: { key: SETTING_KEYS.loanPolicyContent, value: data.content, updatedBy: actor.id },
      update: { value: data.content, updatedBy: actor.id },
    }),
    prisma.appSetting.upsert({
      where: { key: SETTING_KEYS.loanPolicyEffectiveDate },
      create: { key: SETTING_KEYS.loanPolicyEffectiveDate, value: data.effectiveDate, updatedBy: actor.id },
      update: { value: data.effectiveDate, updatedBy: actor.id },
    }),
  ])
  await writeAudit({
    userId: actor.id,
    action: 'LOAN_POLICY_UPDATE',
    entity: 'AppSetting',
    entityId: 'loan_policy',
    newValue: { title: data.title, effectiveDate: data.effectiveDate },
  })
  refreshSettings()
  revalidatePath('/dashboard/member/loans')
  revalidatePath('/admin/loans')
}

export async function toggleFeatureFlag(formData: FormData) {
  const actor = await requireAdmin()
  const key = z.enum([FEATURE_FLAGS.loansEnabled, FEATURE_FLAGS.welfareEnabled]).parse(formData.get('key'))
  const raw = formData.get('enabled')
  // Accept explicit true/false from toggles, or legacy checkbox presence.
  const enabled =
    typeof raw === 'string'
      ? raw === 'true' || raw === 'on' || raw === '1'
      : formData.has('enabled')
  await setFeatureFlag(key, enabled, actor.id)
  await writeAudit({
    userId: actor.id,
    action: 'FEATURE_FLAG_UPDATE',
    entity: 'FeatureFlag',
    entityId: key,
    newValue: { enabled },
  })
  refreshSettings()
  if (key === FEATURE_FLAGS.loansEnabled) {
    revalidatePath('/admin/loans')
    revalidatePath('/dashboard/member/loans')
    revalidatePath('/dashboard/treasurer/loans')
    revalidatePath('/dashboard/executive/loans')
  } else {
    revalidatePath('/dashboard/member/welfare')
    revalidatePath('/dashboard/treasurer/welfare')
  }
}

export async function upsertWelfareCategory(formData: FormData) {
  const actor = await requireAdmin()
  const data = z
    .object({
      id: z.string().optional(),
      name: z.string().trim().min(2).max(80),
      sortOrder: z.coerce.number().int().default(0),
      active: z.enum(['on', 'off']).optional(),
    })
    .parse({
      id: formData.get('id') || undefined,
      name: formData.get('name'),
      sortOrder: formData.get('sortOrder') || 0,
      active: formData.has('active') ? 'on' : 'off',
    })
  const row = data.id
    ? await prisma.welfareCategory.update({
        where: { id: data.id },
        data: { name: data.name, sortOrder: data.sortOrder, active: data.active === 'on' },
      })
    : await prisma.welfareCategory.create({
        data: { name: data.name, sortOrder: data.sortOrder, active: data.active !== 'off' },
      })
  await writeAudit({
    userId: actor.id,
    action: 'WELFARE_CATEGORY_UPSERT',
    entity: 'WelfareCategory',
    entityId: row.id,
    newValue: { name: row.name },
  })
  refreshSettings()
}

export async function upsertProjectCategory(formData: FormData) {
  const actor = await requireAdmin()
  const data = z
    .object({
      id: z.string().optional(),
      name: z.string().trim().min(2).max(80),
      sortOrder: z.coerce.number().int().default(0),
      active: z.enum(['on', 'off']).optional(),
    })
    .parse({
      id: formData.get('id') || undefined,
      name: formData.get('name'),
      sortOrder: formData.get('sortOrder') || 0,
      active: formData.has('active') ? 'on' : 'off',
    })
  const row = data.id
    ? await prisma.projectCategory.update({
        where: { id: data.id },
        data: { name: data.name, sortOrder: data.sortOrder, active: data.active === 'on' },
      })
    : await prisma.projectCategory.create({
        data: { name: data.name, sortOrder: data.sortOrder, active: data.active !== 'off' },
      })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_CATEGORY_UPSERT',
    entity: 'ProjectCategory',
    entityId: row.id,
    newValue: { name: row.name },
  })
  refreshSettings()
}

export async function upsertMembershipClass(formData: FormData) {
  const actor = await requireAdmin()
  const data = z
    .object({
      id: z.string().optional(),
      name: z.string().trim().min(2).max(80),
      sortOrder: z.coerce.number().int().default(0),
      active: z.enum(['on', 'off']).optional(),
    })
    .parse({
      id: formData.get('id') || undefined,
      name: formData.get('name'),
      sortOrder: formData.get('sortOrder') || 0,
      active: formData.has('active') ? 'on' : 'off',
    })
  const row = data.id
    ? await prisma.membershipClass.update({
        where: { id: data.id },
        data: { name: data.name, sortOrder: data.sortOrder, active: data.active === 'on' },
      })
    : await prisma.membershipClass.create({
        data: { name: data.name, sortOrder: data.sortOrder, active: data.active !== 'off' },
      })
  await writeAudit({
    userId: actor.id,
    action: 'MEMBERSHIP_CLASS_UPSERT',
    entity: 'MembershipClass',
    entityId: row.id,
    newValue: { name: row.name },
  })
  refreshSettings()
}

const billingKindSchema = z.enum(['NONE', 'MONTHLY', 'ANNUAL']).catch('NONE')

export async function addContributionCategory(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const billingKind = billingKindSchema.parse(formData.get('billingKind') || 'NONE')
  const name = z
    .string()
    .trim()
    .min(2, 'Category name must be at least 2 characters.')
    .max(60, 'Category name must be 60 characters or fewer.')
    .regex(CATEGORY_NAME_PATTERN, 'Use letters, numbers, spaces and basic punctuation only.')
    .parse(formData.get('name'))
  const duplicate = await prisma.transactionCategory.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  })
  if (duplicate) throw new Error('A category with this name already exists.')
  const code = await uniqueCategoryCode(name)
  const row = await prisma.transactionCategory.create({
    data: { code, name, type: billingKind === 'NONE' ? 'BOTH' : 'INCOME', active: true, billingKind },
  })
  await writeAudit({
    userId: actor.id,
    action: 'CONTRIBUTION_CATEGORY_UPSERT',
    entity: 'TransactionCategory',
    entityId: row.id,
    newValue: { code: row.code, name: row.name, billingKind },
  })
  refreshCategories()
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    billingKind: row.billingKind,
    system: isSystemCategoryCode(row.code),
  }
}

/** Marks a purpose as the monthly fee or annual subscription used by membership standing. */
export async function setCategoryBillingKind(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const id = z.string().min(1).parse(formData.get('id'))
  const billingKind = billingKindSchema.parse(formData.get('billingKind'))
  const category = await prisma.transactionCategory.findUniqueOrThrow({ where: { id } })
  if (isSystemCategoryCode(category.code)) throw new Error('System categories cannot be changed.')
  await prisma.transactionCategory.update({ where: { id }, data: { billingKind } })
  await writeAudit({
    userId: actor.id,
    action: 'CONTRIBUTION_CATEGORY_BILLING_KIND',
    entity: 'TransactionCategory',
    entityId: id,
    oldValue: { billingKind: category.billingKind },
    newValue: { billingKind },
  })
  refreshCategories()
}

export async function deleteContributionCategory(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const id = z.string().min(1).parse(formData.get('id'))
  const category = await prisma.transactionCategory.findUniqueOrThrow({ where: { id } })
  if (isSystemCategoryCode(category.code)) throw new Error('System categories cannot be deleted.')
  let archived = false
  try {
    await prisma.transactionCategory.delete({ where: { id } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      await prisma.transactionCategory.update({
        where: { id },
        data: { active: false },
      })
      archived = true
    } else {
      throw error
    }
  }
  await writeAudit({
    userId: actor.id,
    action: 'CONTRIBUTION_CATEGORY_DELETE',
    entity: 'TransactionCategory',
    entityId: id,
    oldValue: { code: category.code, name: category.name, archived },
  })
  refreshCategories()
}

const TOGGLEABLE_ROLES = ['EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER', 'AUDITOR'] as const

export async function setRoleActive(role: string, active: boolean) {
  const actor = await requireAdmin()
  const parsed = z.enum(TOGGLEABLE_ROLES).safeParse(role)
  if (!parsed.success) throw new Error('That role cannot be deactivated.')

  const row = await prisma.appSetting.findUnique({ where: { key: DISABLED_ROLES_SETTING } })
  const previous = parseDisabledRoles(row?.value)
  const next = active
    ? previous.filter((value) => value !== parsed.data)
    : Array.from(new Set([...previous, parsed.data]))
  const value = JSON.stringify(next)
  await prisma.appSetting.upsert({
    where: { key: DISABLED_ROLES_SETTING },
    create: { key: DISABLED_ROLES_SETTING, value, updatedBy: actor.id },
    update: { value, updatedBy: actor.id },
  })
  await writeAudit({
    userId: actor.id,
    action: 'ROLE_CATALOGUE_UPDATE',
    entity: 'AppSetting',
    entityId: DISABLED_ROLES_SETTING,
    oldValue: { disabledRoles: previous },
    newValue: { role: parsed.data, active, disabledRoles: next },
  })
  revalidateTag(DISABLED_ROLES_TAG)
  revalidatePath('/admin/roles')
  return { disabledRoles: next }
}
