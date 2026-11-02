import { createServerClient } from '@/lib/supabase-server'
import { GALLERY_SIZES } from '@/lib/gallery-image'

const PUBLIC_PREFIX = '/storage/v1/object/public/gallery/'
const VARIANT = /-(480|960|1600)\.webp$/

/**
 * Storage paths behind gallery photo URLs: all three sizes for processed photos, the single
 * file for older uploads. Only `gallery-photos/` is touched — the bucket also holds announcement
 * and cover images that a pasted URL could point at — and links to other sites are skipped.
 */
export function galleryStoragePaths(urls: string[]) {
  const paths: string[] = []
  for (const url of urls) {
    let pathname: string
    try { pathname = decodeURIComponent(new URL(url).pathname) } catch { continue }
    const at = pathname.indexOf(PUBLIC_PREFIX)
    if (at === -1) continue
    const path = pathname.slice(at + PUBLIC_PREFIX.length)
    if (!path.startsWith('gallery-photos/')) continue
    if (VARIANT.test(path)) paths.push(...GALLERY_SIZES.map((size) => path.replace(VARIANT, `-${size}.webp`)))
    else paths.push(path)
  }
  return paths
}

/** Frees the bucket space used by deleted photos. Failures are logged, never thrown. */
export async function removeGalleryFiles(urls: string[]) {
  const paths = galleryStoragePaths(urls)
  if (!paths.length) return
  const storage = createServerClient().storage.from('gallery')
  for (let i = 0; i < paths.length; i += 900) {
    const { error } = await storage.remove(paths.slice(i, i + 900))
    if (error) console.error('[gallery] could not remove files', error)
  }
}
