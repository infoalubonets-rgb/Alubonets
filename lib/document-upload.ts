import { createServerClient } from '@/lib/supabase-server'

export const DOC_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv'] as const

export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024

export function assertDocumentExtension(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (!extension || !(DOC_EXTS as readonly string[]).includes(extension)) {
    throw new Error('Only PDF, Word, Excel, or CSV files are allowed.')
  }
}

/** Storage path for version 1 of a new repository document. */
export function newRepositoryDocumentPath(fileName: string) {
  assertDocumentExtension(fileName)
  const groupId = crypto.randomUUID()
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return { groupId, path: `repository/${groupId}/v1-${crypto.randomUUID()}-${safe}` }
}

/**
 * Confirms a browser-uploaded object really exists at the path we issued, and reports its
 * true size and content type from Storage. The client sends only a path; its claimed
 * mime type and the existence of the file are never taken on trust.
 */
export async function verifyUploadedObject(storagePath: string, expectedGroupId: string) {
  const prefix = `repository/${expectedGroupId}/`
  if (!storagePath.startsWith(prefix) || storagePath.includes('..')) {
    throw new Error('That upload does not belong to this document.')
  }
  const objectName = storagePath.slice(prefix.length)
  if (!objectName || objectName.includes('/')) {
    throw new Error('That upload does not belong to this document.')
  }
  assertDocumentExtension(objectName)

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
