import { notFound } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import ProjectManagePanel from '@/components/projects/ProjectManagePanel'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { getProjectFinancials } from '@/lib/project-status'

export default async function ExecutiveProjectManagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await requireActiveRole(['ADMIN', 'EXECUTIVE'])
  const { id } = await params
  const [project, members, documents, financials] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        responsibles: { include: { user: { select: { id: true, fullName: true } } } },
        investments: {
          include: { user: { select: { fullName: true } } },
          orderBy: { investedAt: 'desc' },
        },
        milestones: { orderBy: { position: 'asc' } },
        updates: { orderBy: { publishedAt: 'desc' } },
        documents: { include: { document: { select: { id: true, title: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.document.findMany({
      where: { status: { in: ['PUBLISHED', 'DRAFT'] } },
      select: { id: true, title: true },
      orderBy: { uploadedAt: 'desc' },
      take: 100,
    }),
    getProjectFinancials(id),
  ])
  if (!project) notFound()

  return (
    <DashboardShell role={actor.role} title="Manage project" nav={navForRole(actor.role)}>
      <ProjectManagePanel
        project={project}
        financials={financials}
        members={members}
        documents={documents}
        manageBase="/dashboard/executive/projects"
      />
    </DashboardShell>
  )
}
