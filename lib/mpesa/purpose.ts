import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { OTHER_CATEGORY_ID, PROJECT_CATEGORY_ID } from '@/lib/payment-categories'

export const stkPurposeSchema = z.object({
  categoryId: z.string().trim().max(64).optional(),
  campaignId: z.string().trim().max(64).optional(),
  projectId: z.string().trim().max(64).optional(),
  contributionPeriod: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
})

export type StkPurpose = {
  categoryId: string
  campaignId: string | null
  projectId: string | null
  contributionPeriod: string | null
}

/** Resolves what an STK payment is for; stored on the init audit row and replayed by the callback. */
export async function resolveStkPurpose(raw: unknown): Promise<StkPurpose> {
  const input = stkPurposeSchema.parse(raw ?? {})
  const contributionPeriod = input.contributionPeriod || null
  if (input.campaignId) {
    const campaign = await prisma.contributionCampaign.findUniqueOrThrow({
      where: { id: input.campaignId },
      select: { id: true, categoryId: true, active: true },
    })
    if (!campaign.active) throw new Error('This campaign is no longer active.')
    return { categoryId: campaign.categoryId, campaignId: campaign.id, projectId: null, contributionPeriod }
  }
  if (input.projectId) {
    await prisma.project.findUniqueOrThrow({ where: { id: input.projectId }, select: { id: true } })
    return { categoryId: PROJECT_CATEGORY_ID, campaignId: null, projectId: input.projectId, contributionPeriod }
  }
  if (input.categoryId) {
    const category = await prisma.transactionCategory.findUniqueOrThrow({
      where: { id: input.categoryId },
      select: { id: true, active: true },
    })
    if (!category.active) throw new Error('This payment purpose is no longer active.')
    return { categoryId: category.id, campaignId: null, projectId: null, contributionPeriod }
  }
  return { categoryId: OTHER_CATEGORY_ID, campaignId: null, projectId: null, contributionPeriod }
}
