import type { Metadata } from 'next'
import { getPublicProjects } from '@/lib/data/queries'

export const metadata: Metadata = {
  title: 'Projects',
}

export default async function ProjectsPage() {
  const projects = await getPublicProjects()

  return (
    <main className="flex-grow w-full max-w-container-max mx-auto px-md md:px-lg py-lg md:py-xl">
      <div className="flex flex-wrap gap-sm justify-center mb-xl">
        {['All', 'Ongoing', 'Completed', 'Upcoming'].map((label, i) => (
          <span
            key={label}
            className={`px-md py-sm rounded-full font-label-bold text-label-bold min-h-[48px] inline-flex items-center ${
              i === 0
                ? 'bg-secondary-container text-on-primary'
                : 'bg-surface-container text-on-surface-variant border border-outline-variant'
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {projects.length === 0 ? (
        <div className="mb-xxl flex flex-col items-center justify-center text-center py-[80px] gap-md">
          <span className="material-symbols-outlined text-[72px] text-primary/15">assignment</span>
          <h3 className="font-h3 text-h3 text-on-surface">No Projects Yet</h3>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <article key={p.id} className="rounded-xl border border-outline-variant/40 bg-surface p-5">
              <p className="text-xs uppercase tracking-wide text-on-surface-variant">{p.status}</p>
              <h3 className="font-h3 text-h3 mt-1">{p.title}</h3>
              <p className="text-on-surface-variant mt-2">{p.description}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
