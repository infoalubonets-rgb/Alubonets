import type { Prisma } from '@prisma/client'
import type { Role } from '@/lib/auth/types'

/**
 * Notifications are role-specific: a notice tagged with roles (e.g. TREASURER for a loan
 * application) only shows in those workspaces. Untagged notices are personal or general
 * (your payment, a new event) and show in every workspace. The Admin workspace — including
 * Super Admin — sees everything.
 */
function audienceFilter(workspace: Role) {
  return workspace === 'ADMIN'
    ? {}
    : { OR: [{ audienceRoles: { isEmpty: true } }, { audienceRoles: { has: workspace } }] }
}

export function noticeAudienceWhere(workspace: Role): Prisma.UserNotificationWhereInput {
  return audienceFilter(workspace)
}

export function announcementAudienceWhere(workspace: Role): Prisma.AnnouncementWhereInput {
  return audienceFilter(workspace)
}

/** In-memory version of the same rule, for lists already loaded. */
export function visibleInWorkspace(audienceRoles: readonly Role[] | null | undefined, workspace: Role) {
  return workspace === 'ADMIN' || !audienceRoles?.length || audienceRoles.includes(workspace)
}
