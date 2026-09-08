'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveRole, requireAdmin } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase-server'
import { writeAudit } from '@/lib/audit'
import { TAGS } from '@/lib/data/queries'

const refresh = () => {
  revalidatePath('/documents')
  revalidatePath('/documents/manage')
  revalidatePath('/dashboard/member')
  revalidatePath('/dashboard/secretary')
  revalidateTag(TAGS.documents)
}

async function upload(actorId: string, file: File, groupId: string, version: number) {
  if (!file?.size) throw new Error('Choose a document file.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Document must be 10 MB or smaller.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !['pdf', 'doc', 'docx'].includes(extension)) {
    throw new Error('Only PDF and Word documents (.pdf, .doc, .docx) are allowed.')
  }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `repository/${groupId}/v${version}-${crypto.randomUUID()}-${safe}`
  const { error } = await createServerClient().storage.from('documents').upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false })
  if (error) throw new Error(`Document upload failed: ${error.message}`)
  return { path, mimeType: file.type || 'application/octet-stream' }
}

function roles(formData: FormData) {
  return formData.getAll('allowedRoles').map(String) as Role[]
}

export async function createDocumentCategory(formData: FormData) {
  const actor = await requireAdmin()
  const name = z.string().trim().min(2).max(80).parse(formData.get('name'))
  const category = await prisma.documentCategory.create({ data: { name } })
  await writeAudit({ userId: actor.id, action: 'DOCUMENT_CATEGORY_CREATE', entity: 'DocumentCategory', entityId: category.id, newValue: { name } })
  refresh()
}

export async function uploadRepositoryDocument(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY','ORGANIZER'])
  const data = z.object({
    title: z.string().trim().min(2).max(180),
    description: z
      .string()
      .trim()
      .max(280, 'Description must be 280 characters or fewer.')
      .optional()
      .refine((value) => !value || value.length >= 5, {
        message: 'Description must be at least 5 characters, or leave it empty.',
      }),
    categoryId: z.string().min(1),
    accessLevel: z.enum(['PUBLIC','MEMBERS','SELECTED_ROLES','ADMIN_SECRETARY']),
    status: z.enum(['DRAFT','PUBLISHED']),
    effectiveAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
  }).parse({
    title: formData.get('title'), description: formData.get('description') || undefined,
    categoryId: formData.get('categoryId'), accessLevel: formData.get('accessLevel'),
    status: formData.get('status'), effectiveAt: formData.get('effectiveAt') || undefined,
    expiresAt: formData.get('expiresAt') || undefined,
  })
  const category = await prisma.documentCategory.findUniqueOrThrow({ where: { id: data.categoryId } })
  const groupId = crypto.randomUUID()
  const file = await upload(actor.id, formData.get('file') as File, groupId, 1)
  const document = await prisma.document.create({ data: {
    ...data, category: category.name, allowedRoles: roles(formData), storagePath: file.path, fileUrl: `storage://documents/${file.path}`,
    mimeType: file.mimeType, uploadedBy: actor.id, versionGroupId: groupId,
  } })
  await writeAudit({ userId: actor.id, action: data.status === 'PUBLISHED' ? 'DOCUMENT_PUBLISH' : 'DOCUMENT_UPLOAD', entity: 'Document', entityId: document.id, newValue: { ...data, category: category.name, version: 1 } })
  refresh()
}

export async function uploadReport(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY'])
  const data = z.object({
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().max(4000).optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']),
  }).parse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    status: formData.get('status'),
  })
  const source = formData.get('file') as File
  if (!source?.size) throw new Error('Choose a report file.')
  if (source.size > 15 * 1024 * 1024) throw new Error('Report must be 15 MB or smaller.')
  const extension = source.name.split('.').pop()?.toLowerCase()
  if (!extension || !['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv'].includes(extension)) {
    throw new Error('Reports must be PDF, Word, Excel, or CSV files.')
  }
  const groupId = crypto.randomUUID()
  const safe = source.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `reports/${groupId}/${crypto.randomUUID()}-${safe}`
  const { error } = await createServerClient().storage.from('documents').upload(
    path,
    await source.arrayBuffer(),
    { contentType: source.type || 'application/octet-stream', upsert: false },
  )
  if (error) throw new Error(`Report upload failed: ${error.message}`)
  const { findCategoryIdByName } = await import('@/lib/document-categories')
  const categoryId = await findCategoryIdByName('Reports')
  const report = await prisma.document.create({ data: {
    title: data.title,
    description: data.description,
    category: 'Reports',
    categoryId,
    accessLevel: 'MEMBERS',
    status: data.status,
    storagePath: path,
    fileUrl: `storage://documents/${path}`,
    mimeType: source.type || 'application/octet-stream',
    uploadedBy: actor.id,
    versionGroupId: groupId,
    effectiveAt: data.status === 'PUBLISHED' ? new Date() : null,
  } })
  await writeAudit({
    userId: actor.id,
    action: data.status === 'PUBLISHED' ? 'REPORT_PUBLISH' : 'REPORT_DRAFT_CREATE',
    entity: 'Document',
    entityId: report.id,
    newValue: { title: report.title, status: report.status, format: extension },
  })
  revalidatePath('/meetings-reports')
  refresh()
}

export async function replaceRepositoryDocument(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY','ORGANIZER'])
  const id = z.string().min(1).parse(formData.get('id'))
  const reason = z.string().trim().min(5).max(1000).parse(formData.get('reason'))
  const old = await prisma.document.findUniqueOrThrow({ where: { id } })
  const latest = await prisma.document.findFirst({ where: { versionGroupId: old.versionGroupId }, orderBy: { version: 'desc' } })
  if (latest?.id !== old.id) throw new Error('Only the latest document version can be replaced.')
  const version = old.version + 1
  const file = await upload(actor.id, formData.get('file') as File, old.versionGroupId, version)
  const next = await prisma.document.create({ data: {
    title: old.title, description: old.description, category: old.category, categoryId: old.categoryId,
    accessLevel: old.accessLevel, allowedRoles: old.allowedRoles, status: old.status,
    effectiveAt: old.effectiveAt, expiresAt: old.expiresAt, storagePath: file.path,
    fileUrl: `storage://documents/${file.path}`, mimeType: file.mimeType, uploadedBy: actor.id,
    versionGroupId: old.versionGroupId, version, previousVersionId: old.id,
  } })
  await writeAudit({ userId: actor.id, action: 'DOCUMENT_REPLACE', entity: 'Document', entityId: next.id, reason, oldValue: { id: old.id, version: old.version }, newValue: { id: next.id, version } })
  refresh()
}

export async function setDocumentStatus(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY','ORGANIZER'])
  const id = z.string().min(1).parse(formData.get('id'))
  const status = z.enum(['DRAFT','PUBLISHED','ARCHIVED','EXPIRED']).parse(formData.get('status'))
  const reason = z.string().trim().min(3).max(500).parse(formData.get('reason'))
  const old = await prisma.document.findUniqueOrThrow({ where: { id } })
  const updated = await prisma.document.update({
    where: { id },
    data: {
      status,
      archivedAt: status === 'ARCHIVED' ? new Date() : null,
    },
  })
  await writeAudit({ userId: actor.id, action: 'DOCUMENT_STATUS_CHANGE', entity: 'Document', entityId: id, reason, oldValue: { status: old.status }, newValue: { status: updated.status } })
  refresh()
}

export async function setSelectedDocumentStatus(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY','ORGANIZER'])
  const singleId = z.string().optional().parse(formData.get('singleId') || undefined)
  const ids = singleId ? [singleId] : formData.getAll('documentIds').map(String)
  if (!ids.length) throw new Error('Select at least one document.')

  const documents = await prisma.document.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, title: true },
  })
  const requestedStatus = formData.get('status')
  const status = requestedStatus
    ? z.enum(['DRAFT','PUBLISHED']).parse(requestedStatus)
    : documents[0]?.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
  await prisma.document.updateMany({ where: { id: { in: ids } }, data: { status } })
  await Promise.all(documents.map((document) => writeAudit({
    userId: actor.id,
    action: status === 'PUBLISHED' ? 'DOCUMENT_PUBLISH' : 'DOCUMENT_HIDE',
    entity: 'Document',
    entityId: document.id,
    reason: status === 'PUBLISHED' ? 'Published to the member repository' : 'Hidden from the member repository',
    oldValue: { status: document.status },
    newValue: { status, title: document.title },
  })))
  refresh()
}

export async function deleteRepositoryDocument(formData: FormData) {
  const actor = await requireAdmin()
  const id = z.string().min(1).parse(formData.get('id'))
  const reason = z.string().trim().min(5).max(1000).parse(formData.get('reason'))
  const document = await prisma.document.findUniqueOrThrow({ where: { id } })
  if (document.storagePath) await createServerClient().storage.from('documents').remove([document.storagePath])
  await prisma.document.delete({ where: { id } })
  await writeAudit({ userId: actor.id, action: 'DOCUMENT_DELETE', entity: 'Document', entityId: id, reason, oldValue: { title: document.title, version: document.version, storagePath: document.storagePath } })
  refresh()
}
