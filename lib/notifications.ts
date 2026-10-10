import { prisma } from '@/lib/prisma'
import type { Role } from '@/lib/auth/types'

type WorkRole = 'ADMIN' | 'EXECUTIVE' | 'TREASURER' | 'SECRETARY' | 'ORGANIZER' | 'AUDITOR'

export async function notifyUsers(input: {
  userIds: string[]
  title: string
  body?: string
  href?: string
  type: string
  entity?: string
  entityId?: string
  /** Workspaces this notice belongs to; leave empty for personal or general notices. */
  audienceRoles?: Role[]
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
      audienceRoles: input.audienceRoles ?? [],
    })),
  })
}

/** Everyone who can act in one of these workspaces: main role, extra dashboard access, or Super Admin. */
export async function roleHolderIds(roles: WorkRole[]) {
  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ role: { in: roles } }, { dashboardAccess: { hasSome: roles } }, { isSuperAdmin: true }],
    },
    select: { id: true },
  })
  return users.map((u) => u.id)
}

/** Notifies role holders; the notice only shows in those roles' workspaces (and Admin's). */
export async function notifyRoleHolders(
  roles: WorkRole[],
  payload: Omit<Parameters<typeof notifyUsers>[0], 'userIds' | 'audienceRoles'>,
) {
  await notifyUsers({ ...payload, userIds: await roleHolderIds(roles), audienceRoles: roles })
}
