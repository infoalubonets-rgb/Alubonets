import Link from 'next/link'

const STATUS_STYLES: Record<string, string> = {
  ONGOING: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  COMPLETED: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-300',
  UPCOMING: 'bg-secondary-container/20 text-secondary-container dark:text-orange-400',
}

export type ProjectCardData = {
  id: string
  title: string
  description: string
  status: string
  imageUrl?: string | null
  startDate?: Date | string | null
  endDate?: Date | string | null
  isPublic?: boolean
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })
}

export default function ProjectCard({
  project,
  href,
  showMembersOnlyBadge = true,
}: {
  project: ProjectCardData
  href: string
  showMembersOnlyBadge?: boolean
}) {
  const start = formatDate(project.startDate)
  const end = formatDate(project.endDate)
  const membersOnly = showMembersOnlyBadge && project.isPublic === false

  return (
    <Link href={href} className="block group">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
        {project.imageUrl ? (
          <div className="relative overflow-hidden">
            <img
              src={project.imageUrl}
              alt={project.title}
              className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_STYLES[project.status] ?? STATUS_STYLES.UPCOMING}`}>
                {project.status}
              </span>
              {membersOnly && (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                  <span className="material-symbols-outlined text-[12px]">lock</span>
                  Members only
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="relative flex h-24 items-end bg-gradient-to-br from-primary/10 to-primary/5 px-5 pb-4 dark:from-primary/20 dark:to-primary/5">
            <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 select-none text-[72px] font-black leading-none text-primary/5">P</span>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_STYLES[project.status] ?? STATUS_STYLES.UPCOMING}`}>
                {project.status}
              </span>
              {membersOnly && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                  <span className="material-symbols-outlined text-[12px]">lock</span>
                  Members only
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-2 p-5">
          <h3 className="text-[16px] font-bold leading-snug text-on-surface">{project.title}</h3>
          <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-on-surface-variant">{project.description}</p>

          {(start || end) && (
            <div className="flex items-center gap-1.5 border-t border-outline-variant/40 pt-2 text-[12px] text-on-surface-variant">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>date_range</span>
              {start}
              {start && end && ' — '}
              {end}
            </div>
          )}

          <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary transition-all group-hover:gap-2.5">
            Learn more
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
          </span>
        </div>
      </article>
    </Link>
  )
}
