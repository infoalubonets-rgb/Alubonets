import { getMemberProjects } from '@/lib/data/queries'
import ProjectCard from '@/components/content/ProjectCard'
import MemberGate from '@/components/public/MemberGate'
import { getMemberAccess } from '@/lib/auth/member-access'

export const metadata = { title: 'Projects — Alubonets SHG' }
export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const access = await getMemberAccess()
  if (access.state !== 'paid') {
    return (
      <main className="flex-grow">
        <div className="max-w-container-max mx-auto px-md py-xl md:px-lg">
          {access.state === 'anonymous'
            ? <MemberGate variant="login" what="Projects" returnTo="/projects" />
            : <MemberGate variant="renew" what="Projects" reason={access.reason} />}
        </div>
      </main>
    )
  }
  const projects = await getMemberProjects()

  return (
    <main className="flex-grow">
      <div className="max-w-container-max mx-auto space-y-xl px-md py-xl md:px-lg">
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-xl py-[80px] text-center">
            <span className="material-symbols-outlined mb-4 block text-[64px] text-primary/15">assignment</span>
            <h3 className="font-semibold text-on-surface">No Projects Yet</h3>
            <p className="mt-1 text-[13px] text-on-surface-variant">Check back soon for community updates.</p>
          </div>
        ) : (
          <div className="grid gap-md md:grid-cols-2">
            {projects.map((project, index) => (
              <div key={project.id} className="reveal" style={{ ['--reveal-delay' as string]: `${index * 80}ms` }}>
                <ProjectCard
                  project={{
                    id: project.id,
                    title: project.title,
                    description: project.description,
                    status: project.status,
                    imageUrl: project.imageUrl,
                    startDate: project.startDate,
                    endDate: project.endDate,
                    isPublic: true,
                  }}
                  href={`/projects/${project.id}`}
                  showMembersOnlyBadge={false}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
