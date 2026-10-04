'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveRole, requireAdmin } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase-server'
import { writeAudit } from '@/lib/audit'
import { TAGS } from '@/lib/data/queries'
import { createSignedUpload } from '@/lib/upload-signed'

const DOC_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv'] as const

const refresh = () => {
  revalidatePath('/documents')
  revalidatePath('/documents/manage')
  revalidatePath('/dashboard/member')
  revalidatePath('/dashboard/secretary')
  revalidateTag(TAGS.documents)
}

async function upload(_actorId: string, file: File, groupId: string, version: number) {
  if (!file?.size) throw new Error('Choose a document file.')
  if (file.size > 15 * 1024 * 1024) throw new Error('Document must be 15 MB or smaller.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !(DOC_EXTS as readonly string[]).includes(extension)) {
    throw new Error('Only PDF, Word, Excel, or CSV files are allowed.')
  }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `repository/${groupId}/v${version}-${crypto.randomUUID()}-${safe}`
  const { error } = await createServerClient().storage.from('documents').upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false })
  if (error) throw new Error(`Document upload failed: ${error.message}`)
  return { path, mimeType: file.type || 'application/octet-stream' }
}

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024

/**
 * Confirms a browser-uploaded object really exists at the path we issued, and reports its
 * true size and content type from Storage. The client sends only a path; its claimed
 * mime type and the existence of the file are never taken on trust.
 */
async function verifyUploadedObject(storagePath: string, expectedGroupId: string) {
  const prefix = `repository/${expectedGroupId}/`
  if (!storagePath.startsWith(prefix) || storagePath.includes('..')) {
    throw new Error('That upload does not belong to this document.')
  }
  const objectName = storagePath.slice(prefix.length)
  if (!objectName || objectName.includes('/')) {
    throw new Error('That upload does not belong to this document.')
  }
  const extension = objectName.split('.').pop()?.toLowerCase()
  if (!extension || !(DOC_EXTS as readonly string[]).includes(extension)) {
    throw new Error('Only PDF, Word, Excel, or CSV files are allowed.')
  }

  const { data, error } = await createServerClient()
    .storage.from('documents')
    .list(prefix.replace(/\/$/, ''), { search: objectName, limit: 100 })
  if (error) throw new Error(`Could not verify the upload: ${error.message}`)

  const object = data?.find((entry) => entry.name === objectName)
  if (!object) throw new Error('The uploaded file could not be found. Please upload it again.')

  const size = Number(object.metadata?.size ?? 0)
  if (size <= 0) throw new Error('The uploaded file is empty. Please upload it again.')
  if (size > MAX_DOCUMENT_BYTES) throw new Error('Document must be 15 MB or smaller.')

  return {
    path: storagePath,
    mimeType: String(object.metadata?.mimetype || 'application/octet-stream'),
  }
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

/** Browser uploads straight to Storage; call before uploadRepositoryDocument with storagePath. */
export async function requestRepositoryDocumentUploadUrl(formData: FormData) {
  await requireActiveRole(['ADMIN', 'SECRETARY'])
  const fileName = z.string().min(1).parse(formData.get('fileName'))
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (!extension || !(DOC_EXTS as readonly string[]).includes(extension)) {
    throw new Error('Only PDF, Word, Excel, or CSV files are allowed.')
  }
  const groupId = crypto.randomUUID()
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `repository/${groupId}/v1-${crypto.randomUUID()}-${safe}`
  const signed = await createSignedUpload('documents', path)
  return { ...signed, groupId }
}

export async function uploadRepositoryDocument(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY'])
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
    tags: z.string().optional(),
    effectiveAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
  }).parse({
    title: formData.get('title'), description: formData.get('description') || undefined,
    categoryId: formData.get('categoryId'), accessLevel: formData.get('accessLevel'),
    status: formData.get('status'), tags: formData.get('tags') || undefined,
    effectiveAt: formData.get('effectiveAt') || undefined,
    expiresAt: formData.get('expiresAt') || undefined,
  })
  const category = await prisma.documentCategory.findUniqueOrThrow({ where: { id: data.categoryId } })
  const tags = (data.tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12)

  const storagePath = z.string().min(1).optional().parse(formData.get('storagePath') || undefined)
  const versionGroupId = z.string().min(1).optional().parse(formData.get('versionGroupId') || undefined)
  let file: { path: string; mimeType: string }
  let groupId: string

  if (storagePath && versionGroupId) {
    groupId = versionGroupId
    // Never trust the client's path or mime type — confirm the object against Storage.
    file = await verifyUploadedObject(storagePath, versionGroupId)
  } else {
    groupId = crypto.randomUUID()
    file = await upload(actor.id, formData.get('file') as File, groupId, 1)
  }

  const document = await prisma.document.create({ data: {
    title: data.title,
    description: data.description,
    categoryId: data.categoryId,
    accessLevel: data.accessLevel,
    status: data.status,
    effectiveAt: data.effectiveAt,
    expiresAt: data.expiresAt,
    tags,
    category: category.name,
    allowedRoles: roles(formData),
    storagePath: file.path,
    fileUrl: `storage://documents/${file.path}`,
    mimeType: file.mimeType,
    uploadedBy: actor.id,
    versionGroupId: groupId,
  } })
  await writeAudit({ userId: actor.id, action: data.status === 'PUBLISHED' ? 'DOCUMENT_PUBLISH' : 'DOCUMENT_UPLOAD', entity: 'Document', entityId: document.id, newValue: { ...data, category: category.name, version: 1 } })
  refresh()
  return {
    id: document.id,
    title: document.title,
    status: document.status,
    categoryName: category.name,
    uploadedAt: document.uploadedAt.toISOString(),
  }
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
  if (!extension || !(DOC_EXTS as readonly string[]).includes(extension)) {
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
  const actor = await requireActiveRole(['ADMIN','SECRETARY'])
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

/**
 * Decides whether a document may be destroyed or must be retained.
 *
 * Anything members have already seen, that another record points at, or that forms part of a
 * version chain is group history: it gets archived (hidden, but recoverable) rather than erased.
 * Only an untouched draft can be deleted outright.
 */
async function assessDocumentRetention(id: string) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id },
    include: {
      _count: { select: { downloads: true, projectLinks: true } },
      nextVersion: { select: { id: true } },
      publishedMeeting: { select: { id: true } },
    },
  })

  const reasons: string[] = []
  if (document.status === 'PUBLISHED') reasons.push('it has been published to members')
  if (document._count.downloads > 0) reasons.push('members have downloaded it')
  if (document._count.projectLinks > 0) reasons.push('it is attached to a project')
  if (document.publishedMeeting) reasons.push('it holds published meeting minutes')
  if (document.version > 1 || document.previousVersionId || document.nextVersion) {
    reasons.push('it belongs to a version history')
  }

  return { document, mustRetain: reasons.length > 0, reasons }
}

export async function deleteRepositoryDocument(formData: FormData) {
  // Staff who manage documents may delete; members never reach this page/action.
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY'])
  const id = z.string().min(1).parse(formData.get('id'))
  const reasonRaw = String(formData.get('reason') || '').trim()
  const reason = reasonRaw.length >= 5 ? reasonRaw.slice(0, 1000) : 'Removed from the document repository'
  const { document, mustRetain, reasons } = await assessDocumentRetention(id)

  if (mustRetain) {
    // Archive: the record and its file stay put so the history remains auditable.
    await prisma.document.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    })
    await writeAudit({
      userId: actor.id,
      action: 'DOCUMENT_ARCHIVE',
      entity: 'Document',
      entityId: id,
      reason: `${reason} — archived instead of deleted because ${reasons.join(', ')}.`,
      oldValue: { status: document.status, title: document.title, version: document.version },
      newValue: { status: 'ARCHIVED', retainedBecause: reasons },
    })
    refresh()
    return { archived: true as const, reasons }
  }

  if (document.storagePath) {
    await createServerClient().storage.from('documents').remove([document.storagePath])
  }
  await prisma.document.delete({ where: { id } })
  await writeAudit({
    userId: actor.id,
    action: 'DOCUMENT_DELETE',
    entity: 'Document',
    entityId: id,
    reason,
    oldValue: { title: document.title, version: document.version, storagePath: document.storagePath },
  })
  refresh()
  return { archived: false as const, reasons: [] as string[] }
}

/** Brings an archived document back into the repository as a draft. */
export async function restoreRepositoryDocument(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY'])
  const id = z.string().min(1).parse(formData.get('id'))
  const document = await prisma.document.findUniqueOrThrow({ where: { id } })
  if (document.status !== 'ARCHIVED') throw new Error('Only archived documents can be restored.')

  await prisma.document.update({
    where: { id },
    data: { status: 'DRAFT', archivedAt: null },
  })
  await writeAudit({
    userId: actor.id,
    action: 'DOCUMENT_RESTORE',
    entity: 'Document',
    entityId: id,
    reason: 'Restored from the document archive',
    oldValue: { status: 'ARCHIVED' },
    newValue: { status: 'DRAFT', title: document.title },
  })
  refresh()
}

export async function deleteSelectedRepositoryDocuments(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY'])
  const ids = formData.getAll('documentIds').map(String).filter(Boolean)
  if (!ids.length) throw new Error('Select at least one document.')
  const reasonRaw = String(formData.get('reason') || '').trim()
  const reason = reasonRaw.length >= 5 ? reasonRaw.slice(0, 1000) : 'Bulk deleted from the document repository'

  const existing = await prisma.document.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  })
  if (!existing.length) throw new Error('No matching documents to delete.')

  // Assess each one: history-bearing documents are archived, the rest are removed.
  const assessed = await Promise.all(existing.map((doc) => assessDocumentRetention(doc.id)))
  const toArchive = assessed.filter((entry) => entry.mustRetain)
  const toDelete = assessed.filter((entry) => !entry.mustRetain)

  if (toArchive.length) {
    await prisma.document.updateMany({
      where: { id: { in: toArchive.map((entry) => entry.document.id) } },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    })
  }

  if (toDelete.length) {
    const storagePaths = toDelete
      .map((entry) => entry.document.storagePath)
      .filter((path): path is string => Boolean(path))
    if (storagePaths.length) {
      await createServerClient().storage.from('documents').remove(storagePaths)
    }
    await prisma.document.deleteMany({
      where: { id: { in: toDelete.map((entry) => entry.document.id) } },
    })
  }

  await Promise.all([
    ...toArchive.map((entry) =>
      writeAudit({
        userId: actor.id,
        action: 'DOCUMENT_ARCHIVE',
        entity: 'Document',
        entityId: entry.document.id,
        reason: `${reason} — archived instead of deleted because ${entry.reasons.join(', ')}.`,
        oldValue: { status: entry.document.status, title: entry.document.title, version: entry.document.version, bulk: true },
        newValue: { status: 'ARCHIVED', retainedBecause: entry.reasons },
      }),
    ),
    ...toDelete.map((entry) =>
      writeAudit({
        userId: actor.id,
        action: 'DOCUMENT_DELETE',
        entity: 'Document',
        entityId: entry.document.id,
        reason,
        oldValue: { title: entry.document.title, version: entry.document.version, storagePath: entry.document.storagePath, bulk: true },
      }),
    ),
  ])
  refresh()
}
