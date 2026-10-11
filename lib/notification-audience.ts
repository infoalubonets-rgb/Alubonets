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
  if (workspace === 'TREASURER') return audienceFilter(workspace)
  return { AND: [audienceFilter(workspace), { NOT: { OR: [
    { type: 'finance_request' },
    { entity: { in: ['LoanApplication', 'WelfareRequest'] }, audienceRoles: { isEmpty: false } },
  ] } }] }
}

export function announcementAudienceWhere(workspace: Role): Prisma.AnnouncementWhereInput {
  return workspace === 'TREASURER' ? audienceFilter(workspace) : { AND: [audienceFilter(workspace), { NOT: { title: { startsWith: 'Loan application:' } } }] }
}

/** In-memory version of the same rule, for lists already loaded. */
export function visibleInWorkspace(audienceRoles: readonly Role[] | null | undefined, workspace: Role) {
  return workspace === 'ADMIN' || !audienceRoles?.length || audienceRoles.includes(workspace)
}

/** Hide request work while its module is switched off; retained history stays in the ledger. */
export function enabledRequestNoticesWhere(flags: Record<string, boolean>): Prisma.UserNotificationWhereInput {
  const disabled = [!flags.loans_enabled && 'LoanApplication', !flags.welfare_enabled && 'WelfareRequest'].filter(Boolean) as string[]
  return disabled.length ? { NOT: { entity: { in: disabled }, OR: [{ type: 'finance_request' }, { audienceRoles: { isEmpty: false } }] } } : {}
}
