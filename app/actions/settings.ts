'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { FEATURE_FLAGS, setFeatureFlag } from '@/lib/feature-flags'
import { SETTING_KEYS, setSetting, type SettingKey } from '@/lib/settings'

function refreshSettings() {
  revalidatePath('/admin/settings')
  revalidatePath('/admin')
  revalidatePath('/dashboard/member')
  revalidatePath('/dashboard/treasurer')
  revalidatePath('/dashboard/executive')
}

export async function updateAppSetting(formData: FormData) {
  const actor = await requireAdmin()
  const key = z.string().min(1).parse(formData.get('key')) as SettingKey
  if (!Object.values(SETTING_KEYS).includes(key)) throw new Error('Unknown setting key.')
  const value = String(formData.get('value') ?? '')
  const row = await setSetting(key, value, actor.id)
  await writeAudit({
    userId: actor.id,
    action: 'APP_SETTING_UPDATE',
    entity: 'AppSetting',
    entityId: key,
    newValue: { value: row.value },
  })
  refreshSettings()
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
  const enabled = formData.has('enabled')
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

export async function upsertContributionCategorySetting(formData: FormData) {
  const actor = await requireAdmin()
  const data = z
    .object({
      id: z.string().optional(),
      code: z.string().trim().min(2).max(40),
      name: z.string().trim().min(2).max(80),
      type: z.enum(['INCOME', 'EXPENSE', 'BOTH']),
      active: z.enum(['on', 'off']).optional(),
    })
    .parse({
      id: formData.get('id') || undefined,
      code: formData.get('code'),
      name: formData.get('name'),
      type: formData.get('type') || 'INCOME',
      active: formData.has('active') ? 'on' : 'off',
    })
  const row = data.id
    ? await prisma.transactionCategory.update({
        where: { id: data.id },
        data: { code: data.code, name: data.name, type: data.type, active: data.active === 'on' },
      })
    : await prisma.transactionCategory.create({
        data: { code: data.code, name: data.name, type: data.type, active: data.active !== 'off' },
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
