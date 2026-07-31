import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { moneyNumber } from '@/lib/projects'

export default async function MemberProjectsPage() {
  const actor = await requireActiveRole([
    'ADMIN',
    'SECRETARY',
    'EXECUTIVE',
    'TREASURER',
    'ORGANIZER',
    'MEMBER',
  ])
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      investments: { select: { amount: true } },
      _count: { select: { updates: true, comments: true } },
    },
  })

  return (
    <DashboardShell role={actor.role} title="Projects" nav={navForRole(actor.role)}>
      <div className="space-y-4 p-4 md:p-6">
        <p className="text-sm text-on-surface-variant">
          View project updates and leave comments. Funding totals are shown without individual investor names.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => {
            const raised = project.investments.reduce((sum, row) => sum + moneyNumber(row.amount), 0)
            const target = moneyNumber(project.fundingTargetKes)
            return (
              <article key={project.id} className="rounded-2xl border bg-surface p-5">
                <h2 className="font-h3 text-lg text-primary">{project.title}</h2>
                <p className="mt-1 text-sm text-on-surface-variant line-clamp-3">{project.description}</p>
                <p className="mt-2 text-xs">
                  {project.status} · {project.progress}% · {project._count.updates} updates
                  {target > 0 ? ` · KES ${raised.toLocaleString()} / ${target.toLocaleString()}` : ''}
                </p>
                <Link
                  href={`/projects/${project.id}`}
                  className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm text-on-primary"
                >
                  Open project
                </Link>
              </article>
            )
          })}
        </div>
        {!projects.length && <p className="text-sm">No projects yet.</p>}
      </div>
    </DashboardShell>
  )
}
