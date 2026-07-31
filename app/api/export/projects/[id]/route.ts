import { NextResponse } from 'next/server'
import { requireActiveRole } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/audit'
import { moneyNumber } from '@/lib/projects'

const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActiveRole(['ADMIN', 'EXECUTIVE', 'ORGANIZER'])
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      investments: { include: { user: { select: { fullName: true, email: true } } }, orderBy: { investedAt: 'asc' } },
      milestones: { orderBy: { position: 'asc' } },
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rows: string[][] = [
    ['Section', 'Field', 'Value'],
    ['Project', 'Title', project.title],
    ['Project', 'Status', project.status],
    ['Project', 'Progress', String(project.progress)],
    ['Project', 'Budget KES', String(moneyNumber(project.budgetKes))],
    ['Project', 'Funding target KES', String(moneyNumber(project.fundingTargetKes))],
    ['Project', 'Actual expenditure KES', String(moneyNumber(project.actualExpenditureKes))],
    ...project.investments.map((row) => [
      'Investment',
      row.user.fullName,
      `${moneyNumber(row.amount)}|${row.investedAt.toISOString()}|${row.notes ?? ''}`,
    ]),
    ...project.milestones.map((m) => [
      'Milestone',
      m.title,
      `${m.dueAt?.toISOString() ?? ''}|${m.completedAt?.toISOString() ?? 'open'}`,
    ]),
  ]

  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_EXPORT',
    entity: 'Project',
    entityId: id,
    meta: { format: 'csv' },
  })

  const body = rows.map((row) => row.map(csv).join(',')).join('\r\n')
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="project-${id.slice(0, 8)}.csv"`,
    },
  })
}
