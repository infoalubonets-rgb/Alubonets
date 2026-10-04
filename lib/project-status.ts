import type { ProjectStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { appTodayInputValue } from '@/lib/dates'
import { moneyNumber } from '@/lib/projects'

const COUNTED_STATUSES = ['CONFIRMED', 'RECONCILED'] as const

/**
 * Status from the project dates, compared by calendar day in app time.
 * Returns null when there is no start date, so a manual status is kept.
 */
export function deriveProjectStatus(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  now = new Date(),
): ProjectStatus | null {
  if (!startDate && !endDate) return null
  const today = appTodayInputValue(now)
  const day = (value: Date) => value.toISOString().slice(0, 10)
  if (endDate && day(endDate) < today) return 'COMPLETED'
  if (!startDate) return null
  if (day(startDate) > today) return 'UPCOMING'
  return 'ONGOING'
}

export function fundingProgress(raised: number, target: number) {
  if (target <= 0) return null
  return Math.max(0, Math.min(100, Math.round((raised / target) * 100)))
}

export async function getProjectFinancials(projectId: string) {
  const [investments, contributions, expenses] = await Promise.all([
    prisma.projectInvestment.aggregate({ where: { projectId }, _sum: { amount: true } }),
    prisma.contribution.aggregate({
      where: { projectId, status: { in: [...COUNTED_STATUSES] } },
      _sum: { amount: true },
    }),
    prisma.financialTransaction.aggregate({
      where: { expense: { projectId }, status: { in: [...COUNTED_STATUSES] } },
      _sum: { amount: true },
      _count: true,
    }),
  ])
  const raisedFromInvestments = moneyNumber(investments._sum.amount)
  const raisedFromContributions = moneyNumber(contributions._sum.amount)
  return {
    raisedFromInvestments,
    raisedFromContributions,
    raised: raisedFromInvestments + raisedFromContributions,
    spent: moneyNumber(expenses._sum.amount),
    linkedExpenseCount: expenses._count,
  }
}

/** Recalculate money-based progress and spend for one project. */
export async function syncProjectFinancials(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, fundingTargetKes: true, startDate: true, endDate: true, status: true },
  })
  if (!project) return null
  const financials = await getProjectFinancials(projectId)
  const progress = fundingProgress(financials.raised, moneyNumber(project.fundingTargetKes))
  const status = deriveProjectStatus(project.startDate, project.endDate)
  await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(progress === null ? {} : { progress }),
      ...(financials.linkedExpenseCount > 0 ? { actualExpenditureKes: financials.spent } : {}),
      ...(status && status !== project.status ? { status } : {}),
    },
  })
  return { ...financials, progress, status }
}

/** Daily: move projects between Upcoming, Ongoing and Completed from their dates. */
export async function syncProjectStatuses(now = new Date()) {
  const projects = await prisma.project.findMany({
    where: { OR: [{ startDate: { not: null } }, { endDate: { not: null } }] },
    select: { id: true, status: true, startDate: true, endDate: true },
  })
  let updated = 0
  for (const project of projects) {
    const next = deriveProjectStatus(project.startDate, project.endDate, now)
    if (next && next !== project.status) {
      await prisma.project.update({ where: { id: project.id }, data: { status: next } })
      updated++
    }
  }
  return { checked: projects.length, updated }
}
