'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { FEATURE_FLAGS, setFeatureFlag } from '@/lib/feature-flags'
import { SETTING_KEYS, setSetting, type SettingKey } from '@/lib/settings'
import { isSystemCategoryCode, uniqueCategoryCode } from '@/lib/payment-categories'

const CATEGORY_NAME_PATTERN = /^[A-Za-z0-9 ()&/,.'-]+$/

function refreshSettings() {
  revalidatePath('/admin/settings')
  revalidatePath('/admin')
  revalidatePath('/admin/announcements')
  revalidatePath('/contact')
  revalidatePath('/')
  revalidatePath('/dashboard/member')
  revalidatePath('/dashboard/treasurer')
  revalidatePath('/dashboard/executive')
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
  approvalThreshold: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireAdmin()
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
      newValue: data,
    })

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

export async function addContributionCategory(formData: FormData) {
  const actor = await requireAdmin()
  const name = z
    .string()
    .trim()
    .min(2, 'Category name must be at least 2 characters.')
    .max(60, 'Category name must be 60 characters or fewer.')
    .regex(CATEGORY_NAME_PATTERN, 'Use letters, numbers, spaces and basic punctuation only.')
    .parse(formData.get('name'))
  const code = await uniqueCategoryCode(name)
  const row = await prisma.transactionCategory.create({
    data: { code, name, type: 'BOTH', active: true },
  })
  await writeAudit({
    userId: actor.id,
    action: 'CONTRIBUTION_CATEGORY_UPSERT',
    entity: 'TransactionCategory',
    entityId: row.id,
    newValue: { code: row.code, name: row.name },
  })
  refreshSettings()
}

export async function deleteContributionCategory(formData: FormData) {
  const actor = await requireAdmin()
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
  refreshSettings()
}
