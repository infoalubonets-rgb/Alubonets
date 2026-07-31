import { notFound } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import ProjectManagePanel from '@/components/projects/ProjectManagePanel'
import { requireActiveRole } from '@/lib/auth/session'
import { ORGANIZER_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'

export default async function OrganizerProjectManagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireActiveRole(['ORGANIZER', 'ADMIN'])
  const { id } = await params
  const [project, members, documents] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        responsibles: { include: { user: { select: { id: true, fullName: true } } } },
        comments: {
          include: { author: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
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
  ])
  if (!project) notFound()

  return (
    <DashboardShell role="ORGANIZER" title="Manage project" nav={ORGANIZER_NAV}>
      <ProjectManagePanel
        project={project}
        members={members}
        documents={documents}
        manageBase="/dashboard/organizer/projects"
      />
    </DashboardShell>
  )
}
