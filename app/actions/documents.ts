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
  if (file.size > 15 * 1024 * 1024) throw new Error('Document must be 15 MB or smaller.')
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
  const actor = await requireActiveRole(['ADMIN','SECRETARY'])
  const data = z.object({
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().max(2000).optional(),
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
  const groupId = crypto.randomUUID()
  const file = await upload(actor.id, formData.get('file') as File, groupId, 1)
  const document = await prisma.document.create({ data: {
    ...data, allowedRoles: roles(formData), storagePath: file.path, fileUrl: `storage://documents/${file.path}`,
    mimeType: file.mimeType, uploadedBy: actor.id, versionGroupId: groupId,
  } })
  await writeAudit({ userId: actor.id, action: data.status === 'PUBLISHED' ? 'DOCUMENT_PUBLISH' : 'DOCUMENT_UPLOAD', entity: 'Document', entityId: document.id, newValue: { ...data, version: 1 } })
  refresh()
}

export async function replaceRepositoryDocument(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY'])
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
  const actor = await requireActiveRole(['ADMIN','SECRETARY'])
  const id = z.string().min(1).parse(formData.get('id'))
  const status = z.enum(['DRAFT','PUBLISHED','ARCHIVED']).parse(formData.get('status'))
  const reason = z.string().trim().min(3).max(500).parse(formData.get('reason'))
  const old = await prisma.document.findUniqueOrThrow({ where: { id } })
  const updated = await prisma.document.update({ where: { id }, data: { status, archivedAt: status === 'ARCHIVED' ? new Date() : null } })
  await writeAudit({ userId: actor.id, action: 'DOCUMENT_STATUS_CHANGE', entity: 'Document', entityId: id, reason, oldValue: { status: old.status }, newValue: { status: updated.status } })
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

