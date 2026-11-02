import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'

vi.mock('@/lib/supabase-server', () => ({ createServerClient: vi.fn() }))

import { galleryStoragePaths } from '@/lib/gallery-storage'
import { extractZipImages, isSupportedImage, isZip } from '@/lib/gallery-upload'

const BASE = 'https://abc.supabase.co/storage/v1/object/public/gallery/'

describe('galleryStoragePaths', () => {
  it('removes every size of a processed photo', () => {
    expect(galleryStoragePaths([`${BASE}gallery-photos/123-abc-1600.webp`])).toEqual([
      'gallery-photos/123-abc-480.webp',
      'gallery-photos/123-abc-960.webp',
      'gallery-photos/123-abc-1600.webp',
    ])
  })

  it('removes the single file of an older gallery upload', () => {
    expect(galleryStoragePaths([`${BASE}gallery-photos/old%20photo.jpg`])).toEqual(['gallery-photos/old photo.jpg'])
  })

  it('leaves other folders and other sites alone', () => {
    expect(galleryStoragePaths([
      `${BASE}announcements/1-x.jpg`,
      'https://example.com/gallery-photos/1-x-1600.webp',
      'not a url',
    ])).toEqual([])
  })
})

describe('ZIP uploads', () => {
  it('takes images from any folder and skips everything else', async () => {
    const zip = new JSZip()
    zip.file('b 10.jpg', 'x')
    zip.file('trip/b 2.PNG', 'x')
    zip.file('notes.txt', 'x')
    zip.file('.DS_Store', 'x')
    zip.file('__MACOSX/trip/._b 2.PNG', 'x')
    const file = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'photos.zip', { type: 'application/zip' })

    expect(isZip(file)).toBe(true)
    const { images, skipped } = await extractZipImages(file)
    expect(images.map((f) => [f.name, f.type])).toEqual([['b 2.PNG', 'image/png'], ['b 10.jpg', 'image/jpeg']])
    expect(skipped).toBe(3)
  })

  it('recognises photo files by extension or type', () => {
    expect(isSupportedImage(new File(['x'], 'IMG_1.JPEG'))).toBe(true)
    expect(isSupportedImage(new File(['x'], 'scan', { type: 'image/webp' }))).toBe(true)
    expect(isSupportedImage(new File(['x'], 'IMG_1.HEIC'))).toBe(false)
  })
})
