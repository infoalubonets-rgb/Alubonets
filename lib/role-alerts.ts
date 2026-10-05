import { prisma } from '@/lib/prisma'
import { allowedDashboards, type Role } from '@/lib/auth/types'
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/feature-flags'
import { getUnreadAnnouncementCount } from '@/lib/data/queries'

export type RoleAlert = {
  key: string
  role: Role
  icon: string
  title: string
  description: string
  count: number
  href: string
}

type AlertUser = { id: string; role: Role; isSuperAdmin?: boolean; dashboardAccess?: Role[] | null }

type AlertSpec = Omit<RoleAlert, 'count'> & { count: () => Promise<number> }

/** Open work items each role is responsible for, linked to the page where it gets done. */
function alertSpecs(user: AlertUser, flags: { loans: boolean; welfare: boolean }): AlertSpec[] {
  return [
    { key: 'admin-approvals', role: 'ADMIN', icon: 'pending_actions', title: 'Membership applications', description: 'Applicants waiting for approval', href: '/admin/approvals', count: () => prisma.user.count({ where: { status: 'PENDING', rejectedAt: null } }) },
    { key: 'admin-gallery', role: 'ADMIN', icon: 'photo_library', title: 'Gallery queue', description: 'Photos waiting to be published', href: '/admin/gallery-queue', count: () => prisma.galleryPhoto.count({ where: { isPublic: false } }) },
    { key: 'admin-resolutions', role: 'ADMIN', icon: 'gavel', title: 'Resolutions', description: 'Resolutions waiting for a decision', href: '/governance/manage', count: () => prisma.resolution.count({ where: { status: 'PENDING_APPROVAL' } }) },
    ...(flags.loans
      ? [{ key: 'admin-loans', role: 'ADMIN' as const, icon: 'account_balance', title: 'Loan decisions', description: 'Reviewed loans waiting for a final decision', href: '/admin/loans', count: () => prisma.loanApplication.count({ where: { status: 'UNDER_REVIEW' } }) }]
      : []),

    { key: 'treasurer-verify', role: 'TREASURER', icon: 'fact_check', title: 'Payments to verify', description: 'Recorded payments waiting for a second check', href: '/dashboard/treasurer/contributions', count: () => prisma.contribution.count({ where: { status: 'PENDING', NOT: { financialTransaction: { is: { createdById: user.id } } } } }) },
    { key: 'treasurer-unmatched', role: 'TREASURER', icon: 'call_split', title: 'Unmatched M-Pesa payments', description: 'Payments that need to be matched to a member', href: '/dashboard/treasurer/contributions', count: () => prisma.paymentEvent.count({ where: { status: 'UNMATCHED' } }) },
    { key: 'treasurer-ledger', role: 'TREASURER', icon: 'account_balance', title: 'Ledger entries to approve', description: 'Entries and reversals waiting for approval', href: '/dashboard/treasurer/ledger', count: () => prisma.financialTransaction.count({ where: { status: 'PENDING', createdById: { not: user.id } } }) },
    ...(flags.loans
      ? [{ key: 'treasurer-loans', role: 'TREASURER' as const, icon: 'request_quote', title: 'Loan applications', description: 'New applications waiting for treasurer review', href: '/dashboard/treasurer/loans', count: () => prisma.loanApplication.count({ where: { status: 'SUBMITTED' } }) }]
      : []),
    ...(flags.welfare
      ? [{ key: 'treasurer-welfare', role: 'TREASURER' as const, icon: 'volunteer_activism', title: 'Welfare requests', description: 'Requests waiting for treasurer review', href: '/dashboard/treasurer/welfare', count: () => prisma.welfareRequest.count({ where: { status: 'PENDING', treasurerApprovedAt: null } }) }]
      : []),

    { key: 'executive-minutes', role: 'EXECUTIVE', icon: 'summarize', title: 'Minutes to approve', description: 'Meeting minutes submitted for approval', href: '/meetings-reports', count: () => prisma.meeting.count({ where: { status: 'PENDING_APPROVAL' } }) },
    ...(flags.welfare
      ? [{ key: 'executive-welfare', role: 'EXECUTIVE' as const, icon: 'volunteer_activism', title: 'Welfare approvals', description: 'Treasurer-reviewed requests waiting for executive approval', href: '/dashboard/executive/welfare', count: () => prisma.welfareRequest.count({ where: { status: 'PENDING', treasurerApprovedAt: { not: null }, executiveApprovedAt: null } }) }]
      : []),

    { key: 'secretary-drafts', role: 'SECRETARY', icon: 'edit_note', title: 'Draft minutes', description: 'Minutes not yet submitted for approval', href: '/dashboard/secretary/meetings', count: () => prisma.meeting.count({ where: { status: { in: ['DRAFT', 'NOTICE'] }, heldAt: { lt: new Date() } } }) },

    { key: 'organizer-gallery', role: 'ORGANIZER', icon: 'photo_library', title: 'Gallery queue', description: 'Photos waiting to be published', href: '/dashboard/organizer/gallery', count: () => prisma.galleryPhoto.count({ where: { isPublic: false } }) },
    { key: 'organizer-comments', role: 'ORGANIZER', icon: 'forum', title: 'Project comments', description: 'Comments waiting for moderation', href: '/dashboard/organizer/projects', count: () => prisma.projectComment.count({ where: { status: 'PENDING' } }) },

    { key: 'member-announcements', role: 'MEMBER', icon: 'campaign', title: 'Unread announcements', description: 'Notices you have not opened yet', href: '/announcements', count: () => getUnreadAnnouncementCount(user.id) },
    ...(flags.loans
      ? [{ key: 'member-guarantor', role: 'MEMBER' as const, icon: 'handshake', title: 'Guarantor requests', description: 'Members asking you to guarantee their loan', href: '/dashboard/member/loans', count: () => prisma.loanGuarantor.count({ where: { userId: user.id, status: 'PENDING' } }) }]
      : []),
  ]
}

/** Alerts for every workspace the user can open, skipping anything with nothing waiting. */
export async function getRoleAlerts(user: AlertUser): Promise<RoleAlert[]> {
  const [loans, welfare] = await Promise.all([
    isFeatureEnabled(FEATURE_FLAGS.loansEnabled),
    isFeatureEnabled(FEATURE_FLAGS.welfareEnabled),
  ])
  const roles = new Set<Role>([...allowedDashboards(user), 'MEMBER'])
  const specs = alertSpecs(user, { loans, welfare }).filter((spec) => roles.has(spec.role))
  const counts = await Promise.all(specs.map((spec) => spec.count().catch(() => 0)))
  return specs
    .map(({ count: _count, ...spec }, index) => ({ ...spec, count: counts[index] }))
    .filter((alert) => alert.count > 0)
}
