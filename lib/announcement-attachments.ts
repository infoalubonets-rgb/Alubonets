export const MAX_ANNOUNCEMENT_ATTACHMENTS = 3
export const MAX_ANNOUNCEMENT_ATTACHMENT_BYTES = 8 * 1024 * 1024
export const MAX_ANNOUNCEMENT_ATTACHMENTS_TOTAL_BYTES = 20 * 1024 * 1024

export function formatMb(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1)
}
