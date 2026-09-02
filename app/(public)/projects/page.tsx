import { getPublicProjects } from '@/lib/data/queries'
import ProjectCard from '@/components/content/ProjectCard'

export const metadata = { title: 'Projects — Alubonets SHG' }

export default async function ProjectsPage() {
  const projects = await getPublicProjects()

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
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
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
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
