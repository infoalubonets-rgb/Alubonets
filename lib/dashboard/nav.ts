import type { NavItem } from '@/components/dashboard/DashboardShell'
import type { Role } from '@/lib/auth/types'

export type { NavItem }

const CONTRIBUTIONS_NAV: NavItem = {
  icon: 'payments',
  label: 'Payments & Statements',
  href: '/contributions',
}
const ANNOUNCEMENTS_NAV: NavItem = {
  icon: 'campaign',
  label: 'Announcements',
  href: '/announcements',
}
const DIRECTORY_NAV: NavItem = {
  icon: 'contacts',
  label: 'Directory',
  href: '/directory',
}
const TODAY_NAV: NavItem = {
  icon: 'today',
  label: 'Today / Activities',
  href: '/today',
}
const PROJECTS_VIEW_NAV: NavItem = {
  icon: 'work',
  label: 'Projects & investments',
  href: '/dashboard/member/projects',
}
const EVENTS_VIEW_NAV: NavItem = {
  icon: 'event',
  label: 'Events',
  href: '/dashboard/member/events',
}
const MEETINGS_REPORTS_NAV: NavItem = {
  icon: 'summarize',
  label: 'Meetings & reports',
  href: '/meetings-reports',
}
const DOCUMENTS_VIEW_NAV: NavItem = {
  icon: 'folder',
  label: 'Document repository',
  href: '/documents',
}

const FAMILY_NAV: NavItem = {
  icon: 'family_restroom',
  label: 'My Family / Branch',
  href: '/dashboard/member/family',
}
const SUPPORT_CHAT_NAV: NavItem = { icon: 'support_agent', label: 'Support chat', href: '/support-chat' }

export const ADMIN_NAV: NavItem[] = [
  { icon: 'dashboard', label: 'Overview', href: '/admin' },
  { icon: 'group', label: 'Members', href: '/admin/members' },
  { icon: 'pending_actions', label: 'Approvals', href: '/admin/approvals' },
  { icon: 'account_balance', label: 'Finance', href: '/admin/finance' },
  { icon: 'work', label: 'Projects & events', href: '/dashboard/executive/projects', children: [
    EVENTS_VIEW_NAV,
    { icon: 'photo_library', label: 'Gallery queue', href: '/admin/gallery-queue' },
  ] },
  MEETINGS_REPORTS_NAV,
  { icon: 'campaign', label: 'Communications', href: '/admin/announcements' },
  { icon: 'folder_managed', label: 'Documents', href: '/documents/manage', children: [DOCUMENTS_VIEW_NAV] },
  { icon: 'gavel', label: 'Governance', href: '/governance/manage' },
  { icon: 'contacts', label: 'Directory', href: '/directory' },
  { icon: 'today', label: 'Today / Activities', href: '/today' },
  // Admins are members too — keep their own family branch and statement reachable.
  FAMILY_NAV,
  CONTRIBUTIONS_NAV,
  { icon: 'settings', label: 'Settings', href: '/admin/settings', children: [
    { icon: 'history', label: 'Activity logs', href: '/admin/audit-logs' },
  ] },
  { icon: 'admin_panel_settings', label: 'Roles & access', href: '/admin/roles' },
]

export const EXECUTIVE_NAV: NavItem[] = [
  { icon: 'dashboard', label: 'Overview', href: '/dashboard/executive' },
  TODAY_NAV,
  SUPPORT_CHAT_NAV,
  { icon: 'work', label: 'Projects', href: '/dashboard/executive/projects' },
  EVENTS_VIEW_NAV,
  MEETINGS_REPORTS_NAV,
  { icon: 'assessment', label: 'Financial reports', href: '/financial-reports' },
  { icon: 'gavel', label: 'Governance', href: '/governance' },
  DOCUMENTS_VIEW_NAV,
  DIRECTORY_NAV,
  ANNOUNCEMENTS_NAV,
  FAMILY_NAV,
  CONTRIBUTIONS_NAV,
]

/**
 * Auditor is oversight only — financial records, reports, governance and the audit trail.
 * Every destination here is a read view; the role has no create/edit routes.
 */
export const AUDITOR_NAV: NavItem[] = [
  { icon: 'assessment', label: 'Financial reports', href: '/financial-reports' },
  { icon: 'history', label: 'Activity logs', href: '/admin/audit-logs' },
  MEETINGS_REPORTS_NAV,
  { icon: 'gavel', label: 'Governance', href: '/governance' },
  DOCUMENTS_VIEW_NAV,
  DIRECTORY_NAV,
  ANNOUNCEMENTS_NAV,
]

export const TREASURER_NAV: NavItem[] = [
  { icon: 'dashboard', label: 'Overview', href: '/dashboard/treasurer' },
  TODAY_NAV,
  SUPPORT_CHAT_NAV,
  { icon: 'payments', label: 'Member contributions', href: '/dashboard/treasurer/contributions' },
  { icon: 'account_balance', label: 'Financial ledger', href: '/dashboard/treasurer/ledger' },
  { icon: 'rule', label: 'Reconciliation', href: '/dashboard/treasurer/reconciliation' },
  { icon: 'assessment', label: 'Financial reports', href: '/financial-reports' },
  PROJECTS_VIEW_NAV,
  EVENTS_VIEW_NAV,
  MEETINGS_REPORTS_NAV,
  DOCUMENTS_VIEW_NAV,
  { icon: 'gavel', label: 'Governance', href: '/governance' },
  { icon: 'savings', label: 'My contributions', href: '/contributions' },
  FAMILY_NAV,
  DIRECTORY_NAV,
  ANNOUNCEMENTS_NAV,
]

export const SECRETARY_NAV: NavItem[] = [
  { icon: 'dashboard', label: 'Overview', href: '/dashboard/secretary' },
  TODAY_NAV,
  SUPPORT_CHAT_NAV,
  ANNOUNCEMENTS_NAV,
  { icon: 'summarize', label: 'Minutes & reports', href: '/dashboard/secretary/meetings' },
  PROJECTS_VIEW_NAV,
  EVENTS_VIEW_NAV,
  { icon: 'gavel', label: 'Governance', href: '/governance/manage' },
  { icon: 'folder_managed', label: 'Documents', href: '/documents/manage' },
  DOCUMENTS_VIEW_NAV,
  DIRECTORY_NAV,
  FAMILY_NAV,
  CONTRIBUTIONS_NAV,
]

export const ORGANIZER_NAV: NavItem[] = [
  { icon: 'dashboard', label: 'Overview', href: '/dashboard/organizer' },
  TODAY_NAV,
  SUPPORT_CHAT_NAV,
  { icon: 'event', label: 'Events', href: '/dashboard/organizer/events' },
  { icon: 'photo_library', label: 'Gallery', href: '/dashboard/organizer/gallery' },
  { icon: 'work', label: 'Projects', href: '/dashboard/organizer/projects' },
  { icon: 'folder_managed', label: 'Manage documents', href: '/documents/manage' },
  MEETINGS_REPORTS_NAV,
  DOCUMENTS_VIEW_NAV,
  { icon: 'gavel', label: 'Governance', href: '/governance' },
  DIRECTORY_NAV,
  FAMILY_NAV,
  ANNOUNCEMENTS_NAV,
  CONTRIBUTIONS_NAV,
]

export const MEMBER_NAV: NavItem[] = [
  { icon: 'home', label: 'Home', href: '/dashboard/member' },
  TODAY_NAV,
  SUPPORT_CHAT_NAV,
  FAMILY_NAV,
  DIRECTORY_NAV,
  ANNOUNCEMENTS_NAV,
  CONTRIBUTIONS_NAV,
  PROJECTS_VIEW_NAV,
  EVENTS_VIEW_NAV,
  MEETINGS_REPORTS_NAV,
  { icon: 'gavel', label: 'Governance', href: '/governance' },
  DOCUMENTS_VIEW_NAV,
]

export const LOANS_NAV_ITEMS = {
  member: { icon: 'account_balance', label: 'Loans', href: '/dashboard/member/loans' } satisfies NavItem,
  treasurer: { icon: 'account_balance', label: 'Loans', href: '/dashboard/treasurer/loans' } satisfies NavItem,
  admin: { icon: 'account_balance', label: 'Loans', href: '/admin/loans' } satisfies NavItem,
  executive: { icon: 'account_balance', label: 'Loans', href: '/dashboard/executive/loans' } satisfies NavItem,
}

export const WELFARE_NAV_ITEMS = {
  member: { icon: 'volunteer_activism', label: 'Welfare', href: '/dashboard/member/welfare' } satisfies NavItem,
  treasurer: { icon: 'volunteer_activism', label: 'Welfare', href: '/dashboard/treasurer/welfare' } satisfies NavItem,
  executive: { icon: 'volunteer_activism', label: 'Welfare approvals', href: '/dashboard/executive/welfare' } satisfies NavItem,
}

export function withOptionalNav(nav: NavItem[], item: NavItem | null, afterHref?: string): NavItem[] {
  if (!item) return nav
  if (!afterHref) return [...nav, item]
  const idx = nav.findIndex((n) => n.href === afterHref)
  if (idx < 0) {
    const parentIdx = nav.findIndex((n) => n.children?.some((child) => child.href === afterHref))
    if (parentIdx < 0) return [...nav, item]
    return nav.map((entry, entryIdx) => entryIdx === parentIdx
      ? { ...entry, children: withOptionalNav(entry.children || [], item, afterHref) }
      : entry)
  }
  if (nav[idx].children) {
    return nav.map((entry, entryIdx) => entryIdx === idx
      ? { ...entry, children: [...(entry.children || []), item] }
      : entry)
  }
  return [...nav.slice(0, idx + 1), item, ...nav.slice(idx + 1)]
}

export function navForRole(role: Role): NavItem[] {
  switch (role) {
    case 'ADMIN':
      return ADMIN_NAV
    case 'EXECUTIVE':
      return EXECUTIVE_NAV
    case 'TREASURER':
      return TREASURER_NAV
    case 'SECRETARY':
      return SECRETARY_NAV
    case 'ORGANIZER':
      return ORGANIZER_NAV
    case 'AUDITOR':
      return AUDITOR_NAV
    case 'MEMBER':
    default:
      return MEMBER_NAV
  }
}
