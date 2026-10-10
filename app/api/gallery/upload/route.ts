import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase-server'
import { GALLERY_MAX_UPLOAD_BYTES, processGalleryImage } from '@/lib/gallery-image-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Same roles as the Gallery page (Admin and Super Admin work in the ADMIN workspace). */
const GALLERY_ROLES = ['ORGANIZER', 'SECRETARY', 'ADMIN']

/**
 * Receives one photo, makes upright, metadata-free WebP copies at 480/960/1600 px and stores
 * them in the `gallery` bucket. Returns the 1600 px URL; the other sizes share its name.
 */
export async function POST(request: Request) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  if (profile.status !== 'ACTIVE' || !GALLERY_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'You cannot add gallery photos from this workspace.' }, { status: 403 })
  }

  let file: File | null = null
  try {
    const value = (await request.formData()).get('file')
    file = value instanceof File ? value : null
  } catch {
    return NextResponse.json({ error: 'Could not read the upload.' }, { status: 400 })
  }
  if (!file || file.size === 0) return NextResponse.json({ error: 'Choose a photo to upload.' }, { status: 400 })
  if (file.size > GALLERY_MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Photos must be 25 MB or smaller.' }, { status: 413 })
  }
  if (file.type && !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files can be added to the gallery.' }, { status: 415 })
  }

  let variants: Awaited<ReturnType<typeof processGalleryImage>>
  try {
    variants = await processGalleryImage(Buffer.from(await file.arrayBuffer()))
  } catch (error) {
    console.error('[gallery upload] processing failed', error)
    return NextResponse.json({ error: 'That file could not be read as an image. Try a JPG, PNG or WebP photo.' }, { status: 422 })
  }

  const storage = createServerClient().storage.from('gallery')
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const paths = variants.map((variant) => `gallery-photos/${id}-${variant.size}.webp`)
  const results = await Promise.all(
    variants.map((variant, index) =>
      storage.upload(paths[index], variant.data, { contentType: 'image/webp', cacheControl: '31536000', upsert: false }),
    ),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) {
    await storage.remove(paths).catch(() => undefined)
    console.error('[gallery upload] storage failed', failed.error)
    return NextResponse.json({ error: `Upload failed: ${failed.error.message}` }, { status: 502 })
  }

  const largest = variants[variants.length - 1]
  return NextResponse.json({
    url: storage.getPublicUrl(paths[paths.length - 1]).data.publicUrl,
    width: largest.width,
    height: largest.height,
    originalBytes: file.size,
    storedBytes: largest.data.length,
  })
}
