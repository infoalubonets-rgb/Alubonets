import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { refreshObligation } from '@/lib/finance'
import { moneyNumber } from '@/lib/projects'

const COUNTED = ['CONFIRMED', 'RECONCILED'] as const

/** Campaigns that still accept new member obligations. */
function openCampaignWhere(now = new Date()): Prisma.ContributionCampaignWhereInput {
  return {
    active: true,
    perMemberTarget: { not: null },
    OR: [{ dueAt: null }, { dueAt: { gte: now } }],
  }
}

/** Give a newly approved member the per-member obligation of every open campaign. */
export async function attachOpenCampaignsToMember(userId: string) {
  const campaigns = await prisma.contributionCampaign.findMany({
    where: openCampaignWhere(),
    select: { id: true, perMemberTarget: true },
  })
  if (campaigns.length === 0) return 0
  const result = await prisma.memberContributionObligation.createMany({
    data: campaigns.map((campaign) => ({
      campaignId: campaign.id,
      userId,
      targetAmount: campaign.perMemberTarget!,
    })),
    skipDuplicates: true,
  })
  return result.count
}

/** Create missing obligations for all active members and align existing targets. */
export async function syncCampaignObligations(campaignId: string) {
  const campaign = await prisma.contributionCampaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { id: true, perMemberTarget: true },
  })
  if (!campaign.perMemberTarget) return { created: 0 }
  const members = await prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } })
  const created = await prisma.memberContributionObligation.createMany({
    data: members.map((member) => ({ campaignId, userId: member.id, targetAmount: campaign.perMemberTarget! })),
    skipDuplicates: true,
  })
  await prisma.memberContributionObligation.updateMany({
    where: { campaignId, status: { not: 'WAIVED' } },
    data: { targetAmount: campaign.perMemberTarget },
  })
  const obligations = await prisma.memberContributionObligation.findMany({
    where: { campaignId, status: { not: 'WAIVED' } },
    select: { userId: true },
  })
  for (const obligation of obligations) await refreshObligation(campaignId, obligation.userId)
  return { created: created.count }
}

export type CampaignMemberRow = {
  obligationId: string | null
  userId: string
  fullName: string
  membershipNumber: string | null
  target: number
  paid: number
  balance: number
  status: string
}

export async function getCampaignProgress(campaignId: string) {
  const campaign = await prisma.contributionCampaign.findUnique({
    where: { id: campaignId },
    include: {
      category: { select: { name: true } },
      obligations: {
        include: { user: { select: { id: true, fullName: true, membershipNumber: true } } },
      },
    },
  })
  if (!campaign) return null
  const paidByUser = await prisma.contribution.groupBy({
    by: ['userId'],
    where: { campaignId, status: { in: [...COUNTED] } },
    _sum: { amount: true },
  })
  const paidMap = new Map(paidByUser.map((row) => [row.userId, moneyNumber(row._sum.amount)]))
  const raised = paidByUser.reduce((sum, row) => sum + moneyNumber(row._sum.amount), 0)
  const target = moneyNumber(campaign.targetAmount)

  const rows: CampaignMemberRow[] = campaign.obligations.map((obligation) => {
    const paid = paidMap.get(obligation.userId) ?? 0
    const memberTarget = moneyNumber(obligation.targetAmount)
    return {
      obligationId: obligation.id,
      userId: obligation.userId,
      fullName: obligation.user.fullName,
      membershipNumber: obligation.user.membershipNumber,
      target: memberTarget,
      paid,
      balance: obligation.status === 'WAIVED' ? 0 : Math.max(0, memberTarget - paid),
      status: obligation.status,
    }
  })
  const withObligation = new Set(rows.map((row) => row.userId))
  const extraPayers = paidByUser.filter((row) => !withObligation.has(row.userId))
  if (extraPayers.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: extraPayers.map((row) => row.userId) } },
      select: { id: true, fullName: true, membershipNumber: true },
    })
    for (const user of users) {
      const paid = paidMap.get(user.id) ?? 0
      rows.push({
        obligationId: null,
        userId: user.id,
        fullName: user.fullName,
        membershipNumber: user.membershipNumber,
        target: 0,
        paid,
        balance: 0,
        status: 'NO_TARGET',
      })
    }
  }
  rows.sort((a, b) => a.fullName.localeCompare(b.fullName))

  return {
    campaign: {
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      categoryName: campaign.category.name,
      categoryId: campaign.categoryId,
      startsAt: campaign.startsAt,
      dueAt: campaign.dueAt,
      active: campaign.active,
      target,
      perMemberTarget: campaign.perMemberTarget == null ? null : moneyNumber(campaign.perMemberTarget),
    },
    raised,
    percent: target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0,
    rows,
  }
}
