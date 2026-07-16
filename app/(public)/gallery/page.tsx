import type { Metadata } from 'next'
import { getPublicGallery } from '@/lib/data/queries'

export const metadata: Metadata = {
  title: 'Gallery',
}

export default async function GalleryPage() {
  const photos = await getPublicGallery()
  const categories = ['All', ...new Set(photos.map((p) => p.category).filter(Boolean) as string[])]

  return (
    <main className="flex-grow">
      <section className="border-b border-outline-variant/30 bg-surface">
        <div className="max-w-container-max mx-auto px-md md:px-lg py-xl flex overflow-x-auto gap-sm md:gap-md hide-scrollbar">
          {categories.map((c, i) => (
            <span
              key={c}
              className={`rounded-full px-lg py-sm font-label-bold text-label-bold whitespace-nowrap min-h-[40px] ${
                i === 0
                  ? 'bg-secondary-container text-on-primary'
                  : 'bg-surface-container-lowest text-on-surface border border-outline-variant'
              }`}
            >
              {c}
            </span>
          ))}
        </div>
      </section>

      <section className="max-w-container-max mx-auto px-md md:px-lg py-lg md:py-xxl">
        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-[80px] gap-md">
            <span className="material-symbols-outlined text-[72px] text-primary/15">photo_library</span>
            <h3 className="font-h3 text-h3 text-on-surface">No Photos Added Yet</h3>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map((p) => (
              <figure key={p.id} className="rounded-xl overflow-hidden border border-outline-variant/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption || 'Gallery photo'} className="h-56 w-full object-cover" />
                <figcaption className="p-3 text-sm">
                  <p className="font-medium">{p.caption || 'Untitled'}</p>
                  {p.category && <p className="text-on-surface-variant">{p.category}</p>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
