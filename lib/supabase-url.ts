/** Strip accidental /rest/v1 suffix — Project URL must be the base host only. */
export function normalizeSupabaseUrl(url: string) {
  return url.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '')
}
