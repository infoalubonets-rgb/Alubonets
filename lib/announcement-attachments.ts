export const MAX_ANNOUNCEMENT_ATTACHMENTS = 3
export const MAX_ANNOUNCEMENT_ATTACHMENT_BYTES = 5 * 1024 * 1024

export const ANNOUNCEMENT_ATTACHMENT_ACCEPT =
  '.pdf,.doc,.docx,.csv,.xls,.xlsx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation'

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.csv', '.xls', '.xlsx', '.ppt', '.pptx'])

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', // some browsers report .csv as text/plain
])

export function formatMb(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function fileExtension(name: string) {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

export function isAllowedAnnouncementAttachment(file: { name: string; type: string }) {
  const ext = fileExtension(file.name)
  if (ext && ALLOWED_EXTENSIONS.has(ext)) return true
  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) return true
  return false
}

export function validateAnnouncementAttachmentFiles(files: File[]): string | null {
  if (files.length > MAX_ANNOUNCEMENT_ATTACHMENTS) {
    return `Attach at most ${MAX_ANNOUNCEMENT_ATTACHMENTS} files (one is usually enough).`
  }
  for (const file of files) {
    if (!isAllowedAnnouncementAttachment(file)) {
      return `"${file.name}" is not allowed. Use PDF, Word, Excel, CSV, or PowerPoint only.`
    }
    if (file.size > MAX_ANNOUNCEMENT_ATTACHMENT_BYTES) {
      return `"${file.name}" is larger than ${formatMb(MAX_ANNOUNCEMENT_ATTACHMENT_BYTES)}MB.`
    }
  }
  return null
}

/** Matches sendBroadcastEmail attachment path: 5 concurrent individual sends. */
const ATTACHMENT_SEND_CONCURRENCY = 5
const SECONDS_PER_ATTACHMENT_EMAIL = 1.5
const SECONDS_PER_BATCH_CHUNK = 2
const BATCH_CHUNK_SIZE = 100

export function estimateAnnouncementSendSeconds(recipientCount: number, hasAttachments: boolean) {
  if (recipientCount <= 0) return 0
  if (hasAttachments) {
    return Math.ceil((recipientCount / ATTACHMENT_SEND_CONCURRENCY) * SECONDS_PER_ATTACHMENT_EMAIL)
  }
  return Math.ceil(recipientCount / BATCH_CHUNK_SIZE) * SECONDS_PER_BATCH_CHUNK
}

export function formatSendDuration(seconds: number) {
  if (seconds <= 0) return 'a few seconds'
  if (seconds < 60) return `about ${seconds} second${seconds === 1 ? '' : 's'}`
  const minutes = Math.ceil(seconds / 60)
  return `about ${minutes} minute${minutes === 1 ? '' : 's'}`
}
