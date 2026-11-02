/**
 * Browser-side helpers for the gallery upload modal: unpacking ZIPs, shrinking photos before
 * they leave the device, and sending several at once to `/api/gallery/upload`.
 */

/** Largest single photo accepted (before it is shrunk in the browser). */
export const GALLERY_MAX_PHOTO_BYTES = 25 * 1024 * 1024
/** Most photos one upload batch can hold — matches the limit in `actionCreateGalleryPhotos`. */
export const GALLERY_MAX_BATCH = 200
/** Largest ZIP the browser unpacks; it is read into memory, so phones need a sensible cap. */
export const GALLERY_MAX_ZIP_BYTES = 500 * 1024 * 1024
/** Uploads in flight at once — enough to fill a typical connection without stalling any one. */
export const GALLERY_UPLOAD_CONCURRENCY = 4

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
}

export function isZip(file: File) {
  return /\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed'
}

export function isSupportedImage(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return Boolean(IMAGE_TYPES[ext]) || Object.values(IMAGE_TYPES).includes(file.type)
}

/** Image files inside a ZIP (any folder depth); macOS resource forks and hidden files are skipped. */
export async function extractZipImages(zip: File): Promise<{ images: File[]; skipped: number }> {
  const { default: JSZip } = await import('jszip')
  const archive = await JSZip.loadAsync(await zip.arrayBuffer())
  const entries = Object.values(archive.files).filter((entry) => !entry.dir)
  const images: File[] = []
  let skipped = 0
  await Promise.all(entries.map(async (entry) => {
    const name = entry.name.split('/').pop() ?? ''
    const type = IMAGE_TYPES[name.split('.').pop()?.toLowerCase() ?? '']
    if (!type || name.startsWith('.') || entry.name.startsWith('__MACOSX/')) { skipped++; return }
    images.push(new File([await entry.async('arraybuffer')], name, { type }))
  }))
  images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  return { images, skipped }
}

const SHRINK_EDGE = 2400
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024

/**
 * Phone photos are often 4–12 MB; the server keeps at most 1600 px, so sending a 2400 px JPEG
 * instead makes uploads several times faster with no visible loss. GIFs (may be animated) and
 * small files go as they are, and anything the browser cannot decode is sent untouched.
 */
export async function shrinkForUpload(file: File): Promise<File> {
  if (file.type === 'image/gif' || file.size <= SHRINK_ABOVE_BYTES || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, SHRINK_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); return file }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export type UploadResult = { url: string; originalBytes: number; storedBytes: number }

/** One photo to the server, which makes the WebP sizes. Progress: 0–85 sending, 100 done. */
export function uploadGalleryPhoto(file: File, onProgress: (pct: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const body = new FormData()
    body.set('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/gallery/upload')
    xhr.responseType = 'json'
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.max(2, Math.round((e.loaded / e.total) * 80)))
    })
    xhr.upload.addEventListener('load', () => onProgress(85))
    xhr.addEventListener('load', () => {
      const data = xhr.response as (UploadResult & { error?: string }) | null
      if (xhr.status >= 200 && xhr.status < 300 && data?.url) {
        onProgress(100)
        resolve(data)
      } else {
        reject(new Error(data?.error || `Upload failed (${xhr.status})`))
      }
    })
    xhr.addEventListener('error', () => reject(new Error('Network error — check your connection')))
    xhr.send(body)
  })
}
