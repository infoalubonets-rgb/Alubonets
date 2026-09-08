import { createClient } from '@/utils/supabase/client'

/** Uploads a file straight to Supabase Storage using a signed URL minted by the server. */
export async function uploadToSignedUrl(bucket: string, path: string, token: string, file: File) {
  const supabase = createClient()
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)
  if (error) throw new Error(error.message)
  return path
}

/**
 * Same as `uploadToSignedUrl`, but over XHR so upload progress is observable.
 * Replicates the Supabase JS SDK's signed-upload request (PUT to
 * `/storage/v1/object/upload/sign/{bucket}/{path}?token=...`) by hand, since the
 * SDK itself uses `fetch` internally and doesn't expose upload progress.
 */
export async function uploadToSignedUrlWithProgress(
  bucket: string,
  path: string,
  token: string,
  file: File,
  onProgress?: (percent: number) => void,
) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase is not configured.')

  const uploadUrl = `${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${path}?token=${encodeURIComponent(token)}`

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('apikey', supabaseKey)
    if (session?.access_token) xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else if (xhr.status === 413) reject(new Error(`"${file.name}" is too large for this upload slot.`))
      else reject(new Error(`Upload failed (${xhr.status}). Please try again.`))
    })
    xhr.addEventListener('error', () => reject(new Error('Network error during upload. Check your connection and try again.')))
    const body = new FormData()
    body.append('cacheControl', '3600')
    body.append('', file)
    xhr.send(body)
  })

  onProgress?.(100)
  return path
}

export function publicUrlFor(bucket: string, path: string) {
  return createClient().storage.from(bucket).getPublicUrl(path).data.publicUrl
}
