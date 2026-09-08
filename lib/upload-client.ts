import { createClient } from '@/utils/supabase/client'

/** Uploads a file straight to Supabase Storage using a signed URL minted by the server. */
export async function uploadToSignedUrl(bucket: string, path: string, token: string, file: File) {
  const supabase = createClient()
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)
  if (error) throw new Error(error.message)
  return path
}

export function publicUrlFor(bucket: string, path: string) {
  return createClient().storage.from(bucket).getPublicUrl(path).data.publicUrl
}
