import { createServerClient } from '@/lib/supabase-server'

/**
 * Mints a one-time signed upload URL so the browser can send file bytes straight to
 * Supabase Storage instead of routing them through the Next.js server (which used to
 * buffer the whole file into memory via `arrayBuffer()` before re-uploading it).
 * Call this only after any role/permission checks — the token itself carries the
 * authorization for that one path, independent of the bucket's RLS policy.
 */
export async function createSignedUpload(bucket: string, path: string) {
  const { data, error } = await createServerClient().storage.from(bucket).createSignedUploadUrl(path)
  if (error || !data) throw new Error(`Could not prepare upload: ${error?.message || 'unknown error'}`)
  return { bucket, path: data.path, token: data.token }
}
