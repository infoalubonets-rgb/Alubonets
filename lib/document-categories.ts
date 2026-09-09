import { prisma } from '@/lib/prisma'

/** Prescribed Stage 4.1 repository categories. */
export const PRESCRIBED_DOCUMENT_CATEGORIES = [
  'Constitution',
  'Policy',
  'Minutes',
  'Finance',
  'Project',
  'Correspondence',
  'Welfare',
  'Education',
  'Health',
  'Archive',
  'Reports',
  'Other',
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

/** Ensures at least one sample row exists so the manage list isn’t empty for first-time setup. */
export async function ensureDemoDocument(uploaderId: string) {
  const existing = await prisma.document.count()
  if (existing > 0) return null

  const category = await prisma.documentCategory.findFirst({
    where: { name: 'Other', active: true },
    select: { id: true, name: true },
  })
  if (!category) return null

  return prisma.document.create({
    data: {
      title: 'Demo document',
      description: 'Sample row so you can try publish, hide, and delete.',
      fileUrl: 'demo://sample-document',
      storagePath: null,
      mimeType: 'application/pdf',
      category: category.name,
      categoryId: category.id,
      accessLevel: 'MEMBERS',
      status: 'DRAFT',
      uploadedBy: uploaderId,
      versionGroupId: crypto.randomUUID(),
    },
  })
}

export async function findCategoryIdByName(name: string) {
  const category = await prisma.documentCategory.findUnique({ where: { name } })
  if (category) return category.id
  const created = await prisma.documentCategory.create({ data: { name, active: true } })
  return created.id
}
