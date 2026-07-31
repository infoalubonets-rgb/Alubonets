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

export async function toggleFeatureFlag(formData: FormData) {
  const actor = await requireAdmin()
  const key = z.literal(FEATURE_FLAGS.loansEnabled).parse(formData.get('key'))
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
  revalidatePath('/admin/loans')
  revalidatePath('/dashboard/member/loans')
  revalidatePath('/dashboard/treasurer/loans')
  revalidatePath('/dashboard/executive/loans')
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
