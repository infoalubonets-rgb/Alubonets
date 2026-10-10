/**
 * Gallery photos are stored as WebP in three sizes (longest side 480, 960 and 1600 px) named
 * `<id>-<size>.webp`. The saved URL is the 1600 one; browsers pick the right size from srcSet.
 * Photos added before this (or pasted URLs) have no variants and are shown as they are.
 */
export const GALLERY_SIZES = [480, 960, 1600] as const
export type GallerySize = (typeof GALLERY_SIZES)[number]

const VARIANT = /-(480|960|1600)\.webp(\?.*)?$/

export function galleryVariantUrl(url: string, size: GallerySize) {
  return url.replace(VARIANT, `-${size}.webp$2`)
}

/** `srcSet` for a processed gallery photo, or undefined for older/external images. */
export function gallerySrcSet(url: string | null | undefined) {
  if (!url || !VARIANT.test(url)) return undefined
  return GALLERY_SIZES.map((size) => `${galleryVariantUrl(url, size)} ${size}w`).join(', ')
}

/** Typical rendered widths: thumbnails in a 1–3 column grid, and the full-screen viewer. */
export const GALLERY_GRID_SIZES = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
export const GALLERY_FULL_SIZES = '100vw'
