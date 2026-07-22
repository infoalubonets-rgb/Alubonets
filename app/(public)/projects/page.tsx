import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublicProjects } from '@/lib/data/queries'

export const metadata: Metadata = { title: 'Projects — Alubonets SHG' }

const STATUS_STYLES: Record<string, string> = {
  ONGOING:   'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  COMPLETED: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-300',
  UPCOMING:  'bg-secondary-container/20 text-secondary-container dark:text-orange-400',
}

export default async function ProjectsPage() {
  const projects = await getPublicProjects()

  return (
    <main className="flex-grow">
      <div className="max-w-container-max mx-auto px-md md:px-lg py-xl space-y-xl">

        {/* Filter pills */}
        <div className="flex flex-wrap gap-sm">
          {['All', 'Ongoing', 'Completed', 'Upcoming'].map((label, i) => (
            <span key={label} className={`px-md py-sm rounded-full font-label-bold text-label-bold min-h-[40px] inline-flex items-center text-[13px] ${
              i === 0
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant border border-outline-variant hover:border-primary/40 cursor-pointer transition-colors'
            }`}>
              {label}
            </span>
          ))}
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-xl text-center py-[80px]">
            <span className="material-symbols-outlined text-[64px] text-primary/15 block mb-4">assignment</span>
            <h3 className="font-semibold text-on-surface">No Projects Yet</h3>
            <p className="text-on-surface-variant text-[13px] mt-1">Check back soon for community updates.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-md">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block group">
                <article className="rounded-2xl border border-outline-variant bg-surface overflow-hidden flex flex-col shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 h-full">

                  {/* Image or gradient header */}
                  {p.imageUrl ? (
                    <div className="overflow-hidden relative">
                      <img src={p.imageUrl} alt={p.title} className="w-full h-44 object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <span className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES[p.status] ?? STATUS_STYLES.UPCOMING}`}>
                        {p.status}
                      </span>
                    </div>
                  ) : (
                    <div className="relative h-24 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/5 flex items-end px-5 pb-4">
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[72px] font-black text-primary/5 leading-none select-none pointer-events-none">P</span>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES[p.status] ?? STATUS_STYLES.UPCOMING}`}>
                        {p.status}
                      </span>
                    </div>
                  )}

                  {/* Body */}
                  <div className="p-5 flex flex-col gap-2 flex-1">
                    <h3 className="font-bold text-[16px] text-on-surface leading-snug">{p.title}</h3>
                    <p className="text-[13px] text-on-surface-variant leading-relaxed line-clamp-3 flex-1">{p.description}</p>

                    {(p.startDate || p.endDate) && (
                      <div className="flex items-center gap-1.5 text-[12px] text-on-surface-variant pt-2 border-t border-outline-variant/40">
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>date_range</span>
                        {p.startDate && new Date(p.startDate).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })}
                        {p.startDate && p.endDate && ' — '}
                        {p.endDate && new Date(p.endDate).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })}
                      </div>
                    )}

                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary mt-1 group-hover:gap-2.5 transition-all">
                      Learn more
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
