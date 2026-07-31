import { prisma } from '@/lib/prisma'

/** Prescribed Stage 4.1 repository categories. */
export const PRESCRIBED_DOCUMENT_CATEGORIES = [
  'Constitution',
  'Policy',
  'Minutes',
  'Finance',
  'Project',
  'Correspondence',
] as const

export async function ensureDocumentCategories() {
  for (const name of PRESCRIBED_DOCUMENT_CATEGORIES) {
    await prisma.documentCategory.upsert({
      where: { name },
      create: { name, active: true },
      update: { active: true },
    })
  }
  return prisma.documentCategory.findMany({
    where: { name: { in: [...PRESCRIBED_DOCUMENT_CATEGORIES] } },
    orderBy: { name: 'asc' },
  })
}

export async function findCategoryIdByName(name: string) {
  const category = await prisma.documentCategory.findUnique({ where: { name } })
  if (category) return category.id
  const created = await prisma.documentCategory.create({ data: { name, active: true } })
  return created.id
}
