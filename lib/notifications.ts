import { prisma } from '@/lib/prisma'

export async function notifyUsers(input: {
  userIds: string[]
  title: string
  body?: string
  href?: string
  type: string
  entity?: string
  entityId?: string
}) {
  const ids = Array.from(new Set(input.userIds.filter(Boolean)))
  if (!ids.length) return
  await prisma.userNotification.createMany({
    data: ids.map((userId) => ({
      userId,
      title: input.title,
      body: input.body || null,
      href: input.href || null,
      type: input.type,
      entity: input.entity || null,
      entityId: input.entityId || null,
    })),
  })
}

export async function notifyRoleHolders(
  roles: Array<'ADMIN' | 'EXECUTIVE' | 'TREASURER' | 'SECRETARY' | 'ORGANIZER' | 'AUDITOR'>,
  payload: Omit<Parameters<typeof notifyUsers>[0], 'userIds'>,
) {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', OR: [{ role: { in: roles } }, { isSuperAdmin: true }] },
    select: { id: true },
  })
  await notifyUsers({ ...payload, userIds: users.map((u) => u.id) })
}
