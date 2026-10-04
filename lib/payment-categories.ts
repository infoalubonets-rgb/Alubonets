import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit } from '@/lib/rate-limit'

/** System category used when treasurer picks "Other" and explains the payment. */
export const OTHER_CATEGORY_ID = 'cat-other-income'

/** Category stamped on payments recorded against a project. */
export const PROJECT_CATEGORY_ID = 'cat-project-contribution'

const SYSTEM_CATEGORY_CODES = new Set([
  'LOAN_DISBURSEMENT',
  'LOAN_REPAYMENT',
  'WELFARE_DISBURSEMENT',
  'OTHER',
  'PROJECT_CONTRIBUTION',
])

export const OTHER_CATEGORY_DESCRIPTION_MIN = 5
export const OTHER_CATEGORY_DESCRIPTION_MAX = 120

export const otherCategoryDescriptionSchema = z
  .string()
  .trim()
  .min(OTHER_CATEGORY_DESCRIPTION_MIN, `Please explain the payment in at least ${OTHER_CATEGORY_DESCRIPTION_MIN} characters.`)
  .max(OTHER_CATEGORY_DESCRIPTION_MAX, `Explanation must be ${OTHER_CATEGORY_DESCRIPTION_MAX} characters or fewer.`)

export function isOtherCategoryId(categoryId: string) {
  return categoryId === OTHER_CATEGORY_ID
}

export function isSystemCategoryCode(code: string) {
  return SYSTEM_CATEGORY_CODES.has(code)
}

export function filterSelectableCategories<T extends { code: string; type: string; active?: boolean }>(
  categories: T[],
  kind: 'income' | 'expense',
): T[] {
  return categories.filter((category) => {
    if (category.active === false || isSystemCategoryCode(category.code)) return false
    if (kind === 'income') return category.type !== 'EXPENSE'
    return category.type !== 'INCOME'
  })
}

export function filterAdminManagedCategories<T extends { code: string; active?: boolean }>(categories: T[]) {
  return categories.filter((category) => category.active !== false && !isSystemCategoryCode(category.code))
}

function slugCode(name: string) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36)
  return base || 'CATEGORY'
}

export async function uniqueCategoryCode(name: string) {
  let code = slugCode(name)
  let suffix = 1
  while (await prisma.transactionCategory.findUnique({ where: { code } })) {
    code = `${slugCode(name).slice(0, 32)}_${suffix}`
    suffix += 1
  }
  return code
}

export async function resolvePaymentCategory(input: {
  categoryId: string
  otherCategoryDescription?: string | null
  actorId: string
  projectId?: string | null
}) {
  if (input.projectId) {
    await prisma.project.findUniqueOrThrow({ where: { id: input.projectId }, select: { id: true } })
    const category = await prisma.transactionCategory.findUniqueOrThrow({ where: { id: PROJECT_CATEGORY_ID } })
    return { categoryId: category.id, otherLabel: null as string | null }
  }
  if (!input.categoryId) throw new Error('Choose the purpose of this payment.')
  if (isOtherCategoryId(input.categoryId)) {
    await enforceRateLimit(`payment-other:${input.actorId}`, 30, 60)
    const otherLabel = otherCategoryDescriptionSchema.parse(input.otherCategoryDescription)
    const category = await prisma.transactionCategory.findUniqueOrThrow({ where: { id: OTHER_CATEGORY_ID } })
    return { categoryId: category.id, otherLabel }
  }

  const category = await prisma.transactionCategory.findUniqueOrThrow({ where: { id: input.categoryId } })
  if (isSystemCategoryCode(category.code)) {
    throw new Error('Choose a payment category from the list or select Other.')
  }
  return { categoryId: category.id, otherLabel: null as string | null }
}

export function paymentDescription(base: string, otherLabel: string | null) {
  return otherLabel ? `Other: ${otherLabel}` : base
}
