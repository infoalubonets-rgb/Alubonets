'use client'

import { useState, useEffect, useCallback } from 'react'
import { GALLERY_FULL_SIZES, GALLERY_GRID_SIZES, gallerySrcSet } from '@/lib/gallery-image'

type Photo = {
  id: string
  url: string
  caption?: string | null
  category?: string | null
}

export default function GalleryClient({ photos }: { photos: Photo[] }) {
  const categories = ['All', ...Array.from(new Set(photos.map((p) => p.category).filter(Boolean) as string[]))]
  const [activeCategory, setActiveCategory] = useState('All')
  const [lightbox, setLightbox] = useState<number | null>(null)

  const filtered = activeCategory === 'All' ? photos : photos.filter((p) => p.category === activeCategory)

  const close = useCallback(() => setLightbox(null), [])
  const prev = useCallback(() => setLightbox((i) => (i !== null && i > 0 ? i - 1 : filtered.length - 1)), [filtered.length])
  const next = useCallback(() => setLightbox((i) => (i !== null ? (i + 1) % filtered.length : 0)), [filtered.length])

  useEffect(() => {
    if (lightbox === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [lightbox, close, prev, next])

  useEffect(() => {
    window.dispatchEvent(new Event('public-reveal-refresh'))
  }, [activeCategory, filtered.length])

  return (
    <>
      {/* Category filter */}
      <section className="border-b border-outline-variant/30 bg-surface">
        <div className="max-w-container-max mx-auto px-md md:px-lg py-xl flex overflow-x-auto gap-sm md:gap-md hide-scrollbar">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`rounded-full px-lg py-sm font-label-bold text-label-bold whitespace-nowrap min-h-[40px] transition-colors ${
                c === activeCategory
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-primary/40'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* Grid */}
      <section className="max-w-container-max mx-auto px-md md:px-lg py-lg md:py-xxl">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-[80px] gap-md">
            <span className="material-symbols-outlined text-[72px] text-primary/15">photo_library</span>
            <h3 className="font-h3 text-h3 text-on-surface">No Photos Yet</h3>
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {filtered.map((p, i) => (
              <figure
                key={p.id}
                className="reveal group relative mb-4 break-inside-avoid cursor-zoom-in overflow-hidden rounded-2xl border border-outline-variant/40 shadow-sm transition-shadow hover:shadow-md"
                style={{ ['--reveal-delay' as string]: `${(i % 6) * 70}ms` }}
                onClick={() => setLightbox(i)}
              >
                <div className="relative overflow-hidden">
                  <img
                    src={p.url}
                    srcSet={gallerySrcSet(p.url)}
                    sizes={GALLERY_GRID_SIZES}
                    alt={p.caption || 'Gallery photo'}
                    loading={i < 6 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="block h-auto w-full transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-opacity text-[32px] drop-shadow-lg">zoom_in</span>
                  </div>
                </div>
                {(p.caption || p.category) && (
                  <figcaption className="p-3">
                    {p.caption && <p className="font-medium text-[14px] text-on-surface">{p.caption}</p>}
                    {p.category && <p className="text-[12px] text-on-surface-variant">{p.category}</p>}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={close}
        >
          {/* Close */}
          <button
            onClick={close}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>

          {/* Counter */}
          <span className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-[13px] font-medium">
            {lightbox + 1} / {filtered.length}
          </span>

          {/* Prev */}
          {filtered.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev() }}
              className="absolute left-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>chevron_left</span>
            </button>
          )}

          {/* Image */}
          <div className="relative max-w-[90vw] max-h-[80vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <img
              key={lightbox}
              src={filtered[lightbox].url}
              srcSet={gallerySrcSet(filtered[lightbox].url)}
              sizes={GALLERY_FULL_SIZES}
              alt={filtered[lightbox].caption || 'Photo'}
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
            />
            {(filtered[lightbox].caption || filtered[lightbox].category) && (
              <div className="text-center">
                {filtered[lightbox].caption && (
                  <p className="text-white font-medium text-[15px]">{filtered[lightbox].caption}</p>
                )}
                {filtered[lightbox].category && (
                  <p className="text-white/50 text-[12px]">{filtered[lightbox].category}</p>
                )}
              </div>
            )}
          </div>

          {/* Next */}
          {filtered.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next() }}
              className="absolute right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>chevron_right</span>
            </button>
          )}
        </div>
      )}
    </>
  )
}
