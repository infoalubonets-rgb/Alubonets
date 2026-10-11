import type { NavItem } from '@/components/dashboard/DashboardShell'
import type { Role } from '@/lib/auth/types'

export type { NavItem }

/*
 * Every role gets the same sidebar as the Administrator — same sections, same names, same
 * order. A section a role can't use is simply left out, and each section opens that role's
 * own page. Related pages (children) show as buttons in the page header, not the sidebar.
 *
 * Overview · Notifications · Members · Finance · Projects & events · Meetings & reports ·
 * Communications · Documents · Governance · My Family · Settings
 */

const ACTIVITIES_NAV: NavItem = { icon: 'today', label: 'Activities', href: '/today' }
const CONTRIBUTIONS_NAV: NavItem = { icon: 'payments', label: 'Payments & statements', href: '/contributions' }
const EVENTS_VIEW_NAV: NavItem = { icon: 'event', label: 'Events', href: '/dashboard/member/events' }
const MANAGE_EVENTS_NAV: NavItem = { icon: 'edit_calendar', label: 'Manage events', href: '/dashboard/organizer/events' }
const DOCUMENTS_VIEW_NAV: NavItem = { icon: 'folder', label: 'Document repository', href: '/documents' }
const FINANCIAL_REPORTS_NAV: NavItem = { icon: 'assessment', label: 'Financial reports', href: '/financial-reports' }

/** Every role's inbox: new activities, role to-dos, payments and group notices. */
const NOTIFICATIONS_NAV: NavItem = { icon: 'notifications', label: 'Notifications', href: '/notifications' }
/** Kept for routing; the shell shows support chat as its own button, not a sidebar link. */
const SUPPORT_CHAT_NAV: NavItem = { icon: 'support_agent', label: 'Support chat', href: '/support-chat' }
const FAMILY_NAV: NavItem = { icon: 'family_restroom', label: 'My Family', href: '/dashboard/member/family' }
const MEMBERS_NAV: NavItem = { icon: 'manage_accounts', label: 'Members', href: '/directory' }

/** Activities is not in the sidebar — it shows as a button in the header of every Overview page. */
const overview = (href: string): NavItem => ({ icon: 'dashboard', label: 'Overview', href, children: [ACTIVITIES_NAV] })
const finance = (href: string, children: NavItem[] = []): NavItem => ({ icon: 'account_balance', label: 'Finance', href, children })
const projectsAndEvents = (href: string, children: NavItem[]): NavItem => ({ icon: 'work', label: 'Projects & events', href, children })
const meetings = (href = '/meetings-reports'): NavItem => ({ icon: 'summarize', label: 'Meetings & reports', href })
const communications = (href: string): NavItem => ({ icon: 'campaign', label: 'Communications', href })
const documentsNav = (href: string, children: NavItem[] = []): NavItem => ({
  icon: href === '/documents/manage' ? 'folder_managed' : 'folder',
  label: 'Documents',
  href,
  children,
})
const governance = (href: string): NavItem => ({ icon: 'gavel', label: 'Governance', href })

export const ADMIN_NAV: NavItem[] = [
  overview('/admin'),
  NOTIFICATIONS_NAV,
  { ...MEMBERS_NAV, children: [{ icon: 'pending_actions', label: 'Approvals', href: '/admin/approvals' }] },
  // Admins are members too — their own contributions statement lives under Finance.
  finance('/admin/finance', [{ ...CONTRIBUTIONS_NAV, label: 'Contributions' }]),
  projectsAndEvents('/dashboard/executive/projects', [
    EVENTS_VIEW_NAV,
    { icon: 'photo_library', label: 'Gallery queue', href: '/admin/gallery-queue' },
  ]),
  meetings(),
  communications('/admin/announcements'),
  documentsNav('/documents/manage', [DOCUMENTS_VIEW_NAV]),
  governance('/governance/manage'),
  { ...FAMILY_NAV, href: '/admin/family' },
  { icon: 'settings', label: 'Settings', href: '/admin/settings', children: [
    { icon: 'admin_panel_settings', label: 'Roles & access', href: '/admin/roles' },
    { icon: 'history', label: 'Activity logs', href: '/admin/audit-logs' },
  ] },
]

export const EXECUTIVE_NAV: NavItem[] = [
  overview('/dashboard/executive'),
  NOTIFICATIONS_NAV,
  MEMBERS_NAV,
  finance('/financial-reports', [CONTRIBUTIONS_NAV]),
  projectsAndEvents('/dashboard/executive/projects', [EVENTS_VIEW_NAV]),
  meetings(),
  communications('/announcements'),
  documentsNav('/documents'),
  governance('/governance'),
  FAMILY_NAV,
  SUPPORT_CHAT_NAV,
]

/**
 * Auditor is oversight only — financial records, reports, governance and the audit trail.
 * Every destination here is a read view; the role has no create/edit routes.
 */
export const AUDITOR_NAV: NavItem[] = [
  NOTIFICATIONS_NAV,
  MEMBERS_NAV,
  finance('/financial-reports'),
  meetings(),
  documentsNav('/documents'),
  governance('/governance'),
  { icon: 'history', label: 'Activity logs', href: '/admin/audit-logs' },
]

export const TREASURER_NAV: NavItem[] = [
  overview('/dashboard/treasurer'),
  NOTIFICATIONS_NAV,
  finance('/dashboard/treasurer/finance', [
    { icon: 'account_balance_wallet', label: 'Financial ledger', href: '/dashboard/treasurer/ledger' },
    { icon: 'settings', label: 'Settings', href: '/dashboard/treasurer/settings' },
    { icon: 'flag', label: 'Campaigns', href: '/dashboard/treasurer/campaigns' },
    FINANCIAL_REPORTS_NAV,
    { icon: 'savings', label: 'My contributions', href: '/contributions' },
    { icon: 'groups', label: 'Member contributions', href: '/contributions?tab=members' },
  ]),
  projectsAndEvents('/dashboard/member/projects', [EVENTS_VIEW_NAV]),
  meetings(),
  documentsNav('/documents'),
  governance('/governance'),
  FAMILY_NAV,
  SUPPORT_CHAT_NAV,
]

export const SECRETARY_NAV: NavItem[] = [
  overview('/dashboard/secretary'),
  NOTIFICATIONS_NAV,
  finance('/contributions'),
  projectsAndEvents('/dashboard/member/projects', [MANAGE_EVENTS_NAV, EVENTS_VIEW_NAV]),
  meetings('/dashboard/secretary/meetings'),
  communications('/announcements'),
  documentsNav('/documents/manage', [DOCUMENTS_VIEW_NAV]),
  governance('/governance/manage'),
  FAMILY_NAV,
  SUPPORT_CHAT_NAV,
]

export const ORGANIZER_NAV: NavItem[] = [
  overview('/dashboard/organizer'),
  NOTIFICATIONS_NAV,
  finance('/contributions'),
  projectsAndEvents('/dashboard/organizer/projects', [MANAGE_EVENTS_NAV]),
  // Its own sidebar entry: the Organizing Secretary adds gallery photos from here.
  { icon: 'photo_library', label: 'Gallery', href: '/dashboard/organizer/gallery' },
  meetings(),
  communications('/announcements'),
  documentsNav('/documents'),
  governance('/governance'),
  FAMILY_NAV,
  SUPPORT_CHAT_NAV,
]

export const MEMBER_NAV: NavItem[] = [
  overview('/dashboard/member'),
  NOTIFICATIONS_NAV,
  finance('/contributions'),
  projectsAndEvents('/dashboard/member/projects', [EVENTS_VIEW_NAV]),
  meetings(),
  documentsNav('/documents'),
  governance('/governance'),
  FAMILY_NAV,
  SUPPORT_CHAT_NAV,
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

