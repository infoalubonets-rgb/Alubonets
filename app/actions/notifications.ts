'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSessionProfile } from '@/lib/auth/session'

export async function markNotificationsRead(formData?: FormData) {
  const actor = await requireSessionProfile()
  const id = z.string().min(1).optional().parse(formData?.get('id') || undefined)
  await prisma.userNotification.updateMany({
    where: {
      userId: actor.id,
      readAt: null,
      ...(id ? { id } : {}),
    },
    data: { readAt: new Date() },
  })
  return { ok: true }
}
