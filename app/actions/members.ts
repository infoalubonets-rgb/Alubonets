'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole, syncAppMetadata } from '@/lib/auth/session'
import { sendMemberApprovedEmail } from '@/lib/email/resend'
import type { Role } from '@prisma/client'

const approveSchema = z.object({
  userId: z.string().min(1),
  approve: z.boolean(),
})

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER']),
})

export async function setMemberApproval(input: z.infer<typeof approveSchema>) {
  const admin = await requireActiveRole(['ADMIN'])
  const { userId, approve } = approveSchema.parse(input)

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  const status = approve ? 'ACTIVE' : 'INACTIVE'
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
  })

  if (updated.authUserId) {
    await syncAppMetadata(updated.authUserId, updated.role, updated.status)
  }

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: approve ? 'MEMBER_APPROVE' : 'MEMBER_REJECT',
      entity: 'User',
      entityId: userId,
    },
  })

  if (approve) {
    await sendMemberApprovedEmail(updated)
  }

  revalidatePath('/admin')
  return updated
}

export async function setMemberRole(input: z.infer<typeof roleSchema>) {
  const admin = await requireActiveRole(['ADMIN'])
  const { userId, role } = roleSchema.parse(input)

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: role as Role },
  })

  if (updated.authUserId) {
    await syncAppMetadata(updated.authUserId, updated.role, updated.status)
  }

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'MEMBER_ROLE_CHANGE',
      entity: 'User',
      entityId: userId,
      meta: { role },
    },
  })

  revalidatePath('/admin')
  return updated
}
