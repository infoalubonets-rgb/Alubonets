import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { processGalleryImage } from '@/lib/gallery-image-server'
import { gallerySrcSet, galleryVariantUrl } from '@/lib/gallery-image'

const photo = (width: number, height: number, orientation?: number) =>
  sharp({ create: { width, height, channels: 3, background: '#3a6' } })
    .jpeg()
    .withMetadata(orientation ? { orientation } : {})
    .toBuffer()

describe('processGalleryImage', () => {
  it('makes WebP copies for every screen size without cropping', async () => {
    const variants = await processGalleryImage(await photo(4000, 2000))
    expect(variants.map((v) => [v.size, v.width, v.height])).toEqual([
      [480, 480, 240],
      [960, 960, 480],
      [1600, 1600, 800],
    ])
    const meta = await sharp(variants[2].data).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.orientation).toBeUndefined()
  })

  it('turns sideways phone photos upright and bounds the longest side', async () => {
    // Stored landscape with EXIF "rotate 90°" — what most phones save for portrait shots.
    const variants = await processGalleryImage(await photo(3000, 1500, 6))
    const largest = variants[2]
    expect([largest.width, largest.height]).toEqual([800, 1600])
  })

  it('never enlarges small photos', async () => {
    const variants = await processGalleryImage(await photo(600, 400))
    expect(variants.map((v) => [v.width, v.height])).toEqual([[480, 320], [600, 400], [600, 400]])
  })

  it('rejects files that are not images', async () => {
    await expect(processGalleryImage(Buffer.from('not an image'))).rejects.toThrow()
  })
})

describe('gallerySrcSet', () => {
  const url = 'https://x.supabase.co/storage/v1/object/public/gallery/gallery-photos/123-abc-1600.webp'

  it('lists all three sizes for processed photos', () => {
    expect(gallerySrcSet(url)).toBe(
      `${galleryVariantUrl(url, 480)} 480w, ${galleryVariantUrl(url, 960)} 960w, ${url} 1600w`,
    )
    expect(galleryVariantUrl(url, 480)).toMatch(/123-abc-480\.webp$/)
  })

  it('leaves older and pasted images alone', () => {
    expect(gallerySrcSet('https://example.com/photo.jpg')).toBeUndefined()
    expect(gallerySrcSet(null)).toBeUndefined()
  })
})
