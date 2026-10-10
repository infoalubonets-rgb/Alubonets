'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { TAGS } from '@/lib/data/queries'
import { isProjectManager } from '@/lib/projects'
import { assertNotFuture, assertNotPast } from '@/lib/dates'
import { amountKes, amountKesOrZero } from '@/lib/money-limits'
import { deriveProjectStatus, syncProjectFinancials } from '@/lib/project-status'
import { createSignedUpload } from '@/lib/upload-signed'
import { newRepositoryDocumentPath, verifyUploadedObject } from '@/lib/document-upload'

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
      budgetKes: amountKesOrZero('Budget'),
      fundingTargetKes: amountKesOrZero('Funding target'),
      actualExpenditureKes: amountKesOrZero('Actual expenditure'),
      reason: z.string().trim().max(500).optional(),
    })
    .parse({
      projectId: formData.get('projectId'),
      budgetKes: formData.get('budgetKes'),
      fundingTargetKes: formData.get('fundingTargetKes'),
      actualExpenditureKes: formData.get('actualExpenditureKes'),
      reason: formData.get('reason') || undefined,
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
  await syncProjectFinancials(data.projectId)
  refreshProject(data.projectId)
}

/** Start and end dates drive the project status automatically. */
export async function updateProjectSchedule(formData: FormData) {
  const actor = await requireManager()
  const data = z
    .object({
      projectId: z.string().min(1),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    })
    .parse({
      projectId: formData.get('projectId'),
      startDate: formData.get('startDate') || undefined,
      endDate: formData.get('endDate') || undefined,
    })
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    throw new Error('The end date cannot be before the start date.')
  }
  const old = await prisma.project.findUniqueOrThrow({ where: { id: data.projectId } })
  const status = deriveProjectStatus(data.startDate, data.endDate) ?? old.status
  const updated = await prisma.project.update({
    where: { id: data.projectId },
    data: {
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      status,
      ...(status === 'COMPLETED' && old.status !== 'COMPLETED' && Number(old.fundingTargetKes) <= 0 ? { progress: 100 } : {}),
    },
  })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_SCHEDULE_UPDATE',
    entity: 'Project',
    entityId: data.projectId,
    oldValue: { startDate: old.startDate, endDate: old.endDate, status: old.status },
    newValue: { startDate: updated.startDate, endDate: updated.endDate, status: updated.status },
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

export async function recordProjectInvestment(formData: FormData) {
  const actor = await requireManager()
  const data = z
    .object({
      projectId: z.string().min(1),
      userId: z.string().min(1),
      amount: amountKes(),
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
  assertNotFuture(data.investedAt, 'Investment date')
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
  await syncProjectFinancials(data.projectId)
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
  await syncProjectFinancials(row.projectId)
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
  assertNotPast(data.dueAt, 'Milestone due date')
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

/** Browser uploads straight to Storage; call before uploadProjectDocument with storagePath. */
export async function requestProjectDocumentUploadUrl(formData: FormData) {
  await requireManager()
  const fileName = z.string().min(1).parse(formData.get('fileName'))
  const { groupId, path } = newRepositoryDocumentPath(fileName)
  const signed = await createSignedUpload('documents', path)
  return { ...signed, groupId }
}

/** Adds the uploaded file to the document repository and links it to the project. */
export async function uploadProjectDocument(formData: FormData) {
  const actor = await requireManager()
  const data = z
    .object({
      projectId: z.string().min(1),
      title: z.string().trim().min(2).max(180),
      storagePath: z.string().min(1),
      versionGroupId: z.string().min(1),
    })
    .parse({
      projectId: formData.get('projectId'),
      title: formData.get('title'),
      storagePath: formData.get('storagePath'),
      versionGroupId: formData.get('versionGroupId'),
    })
  await prisma.project.findUniqueOrThrow({ where: { id: data.projectId }, select: { id: true } })
  const file = await verifyUploadedObject(data.storagePath, data.versionGroupId)
  const category = await prisma.documentCategory.upsert({
    where: { name: 'Projects' },
    create: { name: 'Projects' },
    update: {},
  })
  const document = await prisma.document.create({
    data: {
      title: data.title,
      categoryId: category.id,
      category: category.name,
      accessLevel: 'MEMBERS',
      status: 'PUBLISHED',
      storagePath: file.path,
      fileUrl: `storage://documents/${file.path}`,
      mimeType: file.mimeType,
      uploadedBy: actor.id,
      versionGroupId: data.versionGroupId,
      projectLinks: { create: { projectId: data.projectId } },
    },
  })
  await writeAudit({
    userId: actor.id,
    action: 'PROJECT_DOCUMENT_UPLOAD',
    entity: 'Document',
    entityId: document.id,
    newValue: { projectId: data.projectId, title: data.title, category: category.name },
  })
  revalidatePath('/documents')
  revalidatePath('/documents/manage')
  revalidateTag(TAGS.documents)
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
