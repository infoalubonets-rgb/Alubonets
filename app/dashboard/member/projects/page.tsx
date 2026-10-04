import DashboardShell from '@/components/dashboard/DashboardShell'
import ProjectCard from '@/components/content/ProjectCard'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import MemberGate from '@/components/public/MemberGate'
import { getMemberStanding } from '@/lib/membership-standing-sync'
import { hasPaidUpAccess } from '@/lib/membership-standing'

export default async function MemberProjectsPage() {
  const actor = await requireActiveRole([
    'ADMIN',
    'SECRETARY',
    'EXECUTIVE',
    'TREASURER',
    'ORGANIZER',
    'MEMBER',
  ])
  const { standing, reason } = await getMemberStanding(actor.id)
  if (!hasPaidUpAccess({ role: actor.role, isSuperAdmin: actor.isSuperAdmin, standing })) {
    return (
      <DashboardShell role={actor.role} title="Projects" nav={navForRole(actor.role)}>
        <div className="p-4 md:p-6">
          <MemberGate variant="renew" what="Projects" reason={reason} />
        </div>
      </DashboardShell>
    )
  }
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      imageUrl: true,
      isPublic: true,
      startDate: true,
      endDate: true,
    },
  })

  return (
    <DashboardShell role={actor.role} title="Projects" nav={navForRole(actor.role)}>
      <div className="space-y-4 p-4 md:p-6">
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-xl py-16 text-center">
            <span className="material-symbols-outlined mb-4 block text-[48px] text-primary/20">work_outline</span>
            <p className="text-sm text-on-surface-variant">No projects yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                href={`/projects/${project.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
