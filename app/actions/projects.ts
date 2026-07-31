'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { TAGS, sendAnnouncement } from '@/lib/data/queries'
import { canModerateProjectComments, isProjectManager } from '@/lib/projects'

function refreshProject(projectId?: string) {
  revalidatePath('/projects')
  revalidatePath('/dashboard/executive/projects')
  revalidatePath('/dashboard/organizer/projects')
  revalidatePath('/dashboard/member/projects')
  if (projectId) {
    revalidatePath(`/projects/${projectId}`)
    revalidatePath(`/dashboard/executive/projects/${projectId}`)
    revalidatePath(`/dashboard/organizer/projects/${projectId}`)
  }
  revalidateTag(TAGS.projects)
}

async function requireManager() {
  const actor = await requireActiveRole(['ADMIN', 'EXECUTIVE', 'ORGANIZER'])
  if (!isProjectManager(actor.role) && !actor.isSuperAdmin) {
    throw new Error('Forbidden')
  }
  return actor
}

export async function updateProjectFinance(formData: FormData) {
  const actor = await requireManager()
  const data = z
    .object({
      projectId: z.string().min(1),
      budgetKes: z.coerce.number().min(0),
      fundingTargetKes: z.coerce.number().min(0),
      actualExpenditureKes: z.coerce.number().min(0),
      reason: z.string().trim().min(3).max(500),
    })
    .parse({
      projectId: formData.get('projectId'),
      budgetKes: formData.get('budgetKes'),
      fundingTargetKes: formData.get('fundingTargetKes'),
      actualExpenditureKes: formData.get('actualExpenditureKes'),
      reason: formData.get('reason'),
    })
  const old = await prisma.project.findUniqueOrThrow({ where: { id: data.projectId } })
  const updated = await prisma.project.update({
    where: { id: data.projectId },
    data: {
      budgetKes: data.budgetKes,
      fundingTargetKes: data.fundingTargetKes,
      actualExpenditureKes: data.actualExpenditureKes,
    },
  })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_FINANCE_UPDATE',
    entity: 'Project',
    entityId: data.projectId,
    reason: data.reason,
    oldValue: {
      budgetKes: old.budgetKes,
      fundingTargetKes: old.fundingTargetKes,
      actualExpenditureKes: old.actualExpenditureKes,
    },
    newValue: {
      budgetKes: updated.budgetKes,
      fundingTargetKes: updated.fundingTargetKes,
      actualExpenditureKes: updated.actualExpenditureKes,
    },
  })
  refreshProject(data.projectId)
}

export async function addProjectResponsible(formData: FormData) {
  const actor = await requireManager()
  const data = z
    .object({
      projectId: z.string().min(1),
      userId: z.string().min(1),
      label: z.string().trim().max(80).optional(),
    })
    .parse({
      projectId: formData.get('projectId'),
      userId: formData.get('userId'),
      label: formData.get('label') || undefined,
    })
  const row = await prisma.projectResponsible.upsert({
    where: { projectId_userId: { projectId: data.projectId, userId: data.userId } },
    create: data,
    update: { label: data.label ?? null },
  })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_RESPONSIBLE_ADD',
    entity: 'ProjectResponsible',
    entityId: row.id,
    newValue: data,
  })
  refreshProject(data.projectId)
}

export async function removeProjectResponsible(formData: FormData) {
  const actor = await requireManager()
  const id = z.string().min(1).parse(formData.get('id'))
  const row = await prisma.projectResponsible.findUniqueOrThrow({ where: { id } })
  await prisma.projectResponsible.delete({ where: { id } })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_RESPONSIBLE_REMOVE',
    entity: 'ProjectResponsible',
    entityId: id,
    oldValue: { projectId: row.projectId, userId: row.userId },
  })
  refreshProject(row.projectId)
}

export async function submitProjectComment(formData: FormData) {
  const actor = await requireActiveRole([
    'ADMIN',
    'EXECUTIVE',
    'TREASURER',
    'SECRETARY',
    'ORGANIZER',
    'MEMBER',
  ])
  const data = z
    .object({
      projectId: z.string().min(1),
      body: z.string().trim().min(2).max(2000),
    })
    .parse({
      projectId: formData.get('projectId'),
      body: formData.get('body'),
    })
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: data.projectId },
    include: { responsibles: { select: { userId: true } } },
  })
  const comment = await prisma.projectComment.create({
    data: {
      projectId: data.projectId,
      authorId: actor.id,
      body: data.body,
      status: 'PENDING',
    },
  })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_COMMENT_CREATE',
    entity: 'ProjectComment',
    entityId: comment.id,
    newValue: { projectId: data.projectId, status: 'PENDING' },
  })

  const notifyIds = [
    ...new Set(project.responsibles.map((r) => r.userId).filter((id) => id !== actor.id)),
  ]
  if (notifyIds.length) {
    after(async () => {
      try {
        await sendAnnouncement({
          authorId: actor.id,
          title: `New comment pending on ${project.title}`,
          content: `${actor.fullName} submitted a comment awaiting moderation.`,
          broadcast: false,
          includeSelf: false,
          memberIds: notifyIds,
        })
      } catch (e) {
        console.error(e)
      }
    })
  }

  refreshProject(data.projectId)
}

export async function moderateProjectComment(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN', 'EXECUTIVE'])
  if (!canModerateProjectComments(actor.role) && !actor.isSuperAdmin) {
    throw new Error('Forbidden')
  }
  const data = z
    .object({
      id: z.string().min(1),
      status: z.enum(['PUBLISHED', 'HIDDEN', 'REJECTED', 'PENDING']),
      moderationNote: z.string().trim().max(500).optional(),
      reason: z.string().trim().min(3).max(500),
    })
    .parse({
      id: formData.get('id'),
      status: formData.get('status'),
      moderationNote: formData.get('moderationNote') || undefined,
      reason: formData.get('reason'),
    })
  const old = await prisma.projectComment.findUniqueOrThrow({ where: { id: data.id } })
  const updated = await prisma.projectComment.update({
    where: { id: data.id },
    data: {
      status: data.status,
      moderationNote: data.moderationNote ?? null,
      moderatedById: actor.id,
      moderatedAt: new Date(),
    },
  })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_COMMENT_MODERATE',
    entity: 'ProjectComment',
    entityId: data.id,
    reason: data.reason,
    oldValue: { status: old.status },
    newValue: { status: updated.status, moderationNote: updated.moderationNote },
  })
  refreshProject(old.projectId)
}

export async function recordProjectInvestment(formData: FormData) {
  const actor = await requireManager()
  const data = z
    .object({
      projectId: z.string().min(1),
      userId: z.string().min(1),
      amount: z.coerce.number().positive(),
      investedAt: z.coerce.date().optional(),
      notes: z.string().trim().max(500).optional(),
    })
    .parse({
      projectId: formData.get('projectId'),
      userId: formData.get('userId'),
      amount: formData.get('amount'),
      investedAt: formData.get('investedAt') || undefined,
      notes: formData.get('notes') || undefined,
    })
  const investment = await prisma.projectInvestment.create({
    data: {
      projectId: data.projectId,
      userId: data.userId,
      amount: data.amount,
      investedAt: data.investedAt ?? new Date(),
      notes: data.notes,
      recordedById: actor.id,
    },
  })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_INVESTMENT_CREATE',
    entity: 'ProjectInvestment',
    entityId: investment.id,
    newValue: data,
  })
  refreshProject(data.projectId)
}

export async function deleteProjectInvestment(formData: FormData) {
  const actor = await requireManager()
  const id = z.string().min(1).parse(formData.get('id'))
  const reason = z.string().trim().min(3).max(500).parse(formData.get('reason'))
  const row = await prisma.projectInvestment.findUniqueOrThrow({ where: { id } })
  await prisma.projectInvestment.delete({ where: { id } })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_INVESTMENT_DELETE',
    entity: 'ProjectInvestment',
    entityId: id,
    reason,
    oldValue: { projectId: row.projectId, userId: row.userId, amount: row.amount },
  })
  refreshProject(row.projectId)
}

export async function addProjectMilestone(formData: FormData) {
  const actor = await requireManager()
  const data = z
    .object({
      projectId: z.string().min(1),
      title: z.string().trim().min(2).max(180),
      description: z.string().trim().max(1000).optional(),
      dueAt: z.coerce.date().optional(),
    })
    .parse({
      projectId: formData.get('projectId'),
      title: formData.get('title'),
      description: formData.get('description') || undefined,
      dueAt: formData.get('dueAt') || undefined,
    })
  const position =
    (await prisma.projectMilestone.count({ where: { projectId: data.projectId } })) + 1
  const milestone = await prisma.projectMilestone.create({
    data: { ...data, position },
  })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_MILESTONE_CREATE',
    entity: 'ProjectMilestone',
    entityId: milestone.id,
    newValue: data,
  })
  refreshProject(data.projectId)
}

export async function completeProjectMilestone(formData: FormData) {
  const actor = await requireManager()
  const id = z.string().min(1).parse(formData.get('id'))
  const complete = formData.get('complete') !== 'false'
  const old = await prisma.projectMilestone.findUniqueOrThrow({ where: { id } })
  const updated = await prisma.projectMilestone.update({
    where: { id },
    data: { completedAt: complete ? new Date() : null },
  })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_MILESTONE_COMPLETE',
    entity: 'ProjectMilestone',
    entityId: id,
    oldValue: { completedAt: old.completedAt },
    newValue: { completedAt: updated.completedAt },
  })
  refreshProject(old.projectId)
}

export async function publishProjectUpdate(formData: FormData) {
  const actor = await requireManager()
  const data = z
    .object({
      projectId: z.string().min(1),
      title: z.string().trim().min(2).max(180),
      body: z.string().trim().min(2).max(5000),
    })
    .parse({
      projectId: formData.get('projectId'),
      title: formData.get('title'),
      body: formData.get('body'),
    })
  const update = await prisma.projectUpdate.create({
    data: {
      projectId: data.projectId,
      title: data.title,
      body: data.body,
      authorId: actor.id,
    },
  })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_UPDATE_PUBLISH',
    entity: 'ProjectUpdate',
    entityId: update.id,
    newValue: data,
  })
  refreshProject(data.projectId)
}

export async function linkProjectDocument(formData: FormData) {
  const actor = await requireManager()
  const data = z
    .object({
      projectId: z.string().min(1),
      documentId: z.string().min(1),
    })
    .parse({
      projectId: formData.get('projectId'),
      documentId: formData.get('documentId'),
    })
  const link = await prisma.projectDocument.upsert({
    where: {
      projectId_documentId: { projectId: data.projectId, documentId: data.documentId },
    },
    create: data,
    update: {},
  })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_DOCUMENT_LINK',
    entity: 'ProjectDocument',
    entityId: link.id,
    newValue: data,
  })
  refreshProject(data.projectId)
}

export async function unlinkProjectDocument(formData: FormData) {
  const actor = await requireManager()
  const id = z.string().min(1).parse(formData.get('id'))
  const row = await prisma.projectDocument.findUniqueOrThrow({ where: { id } })
  await prisma.projectDocument.delete({ where: { id } })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_DOCUMENT_UNLINK',
    entity: 'ProjectDocument',
    entityId: id,
    oldValue: { projectId: row.projectId, documentId: row.documentId },
  })
  refreshProject(row.projectId)
}
