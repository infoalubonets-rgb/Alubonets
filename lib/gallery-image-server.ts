import sharp from 'sharp'
import { GALLERY_SIZES, type GallerySize } from '@/lib/gallery-image'

export const GALLERY_MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/**
 * Turns one uploaded photo into WebP copies for every screen size: upright (phone EXIF
 * rotation applied), scaled to fit inside a square of each size — never cropped or enlarged —
 * and stripped of metadata such as GPS location.
 */
export async function processGalleryImage(input: Buffer): Promise<{ size: GallerySize; data: Buffer; width: number; height: number }[]> {
  const base = sharp(input, { failOn: 'none', limitInputPixels: 100_000_000 }).rotate()
  const meta = await base.metadata()
  if (!meta.width || !meta.height) throw new Error('That file is not a readable image.')

  return Promise.all(
    GALLERY_SIZES.map(async (size) => {
      const { data, info } = await base
        .clone()
        .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: size <= 480 ? 72 : 80, effort: 4 })
        .toBuffer({ resolveWithObject: true })
      return { size, data, width: info.width, height: info.height }
    }),
  )
}
