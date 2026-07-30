import type { NavItem } from '@/components/dashboard/DashboardShell'
import type { Role } from '@/lib/auth/types'

const CONTRIBUTIONS_NAV: NavItem = {
  icon: 'payments',
  label: 'Contributions',
  href: '/contributions',
}
const ANNOUNCEMENTS_NAV: NavItem = {
  icon: 'campaign',
  label: 'Announcements',
  href: '/announcements',
}

export const ADMIN_NAV: NavItem[] = [
  { icon: 'dashboard', label: 'Overview', href: '/admin' },
  { icon: 'group', label: 'Members', href: '/admin/members' },
  { icon: 'pending_actions', label: 'Approvals', href: '/admin/approvals' },
  { icon: 'photo_library', label: 'Gallery queue', href: '/admin/gallery-queue' },
  { icon: 'contact_mail', label: 'Contact inbox', href: '/admin/contact-messages' },
  { icon: 'account_balance', label: 'Finance', href: '/admin/finance' },
  { icon: 'folder_managed', label: 'Documents', href: '/documents/manage' },
  { icon: 'gavel', label: 'Governance', href: '/governance/manage' },
  { icon: 'edit_note', label: 'Public content', href: '/admin/content' },
  { icon: 'admin_panel_settings', label: 'Roles', href: '/admin/roles' },
  { icon: 'history', label: 'Activity logs', href: '/admin/audit-logs' },
  ANNOUNCEMENTS_NAV,
  CONTRIBUTIONS_NAV,
]

export const EXECUTIVE_NAV: NavItem[] = [
  { icon: 'dashboard', label: 'Overview', href: '/dashboard/executive' },
  { icon: 'contact_mail', label: 'Contact inbox', href: '/dashboard/executive/contact-messages' },
  { icon: 'work', label: 'Projects', href: '/dashboard/executive/projects' },
  { icon: 'assessment', label: 'Financial reports', href: '/financial-reports' },
  { icon: 'gavel', label: 'Governance', href: '/governance/manage' },
  { icon: 'folder', label: 'Documents', href: '/documents' },
  ANNOUNCEMENTS_NAV,
  CONTRIBUTIONS_NAV,
]

export const TREASURER_NAV: NavItem[] = [
  { icon: 'dashboard', label: 'Overview', href: '/dashboard/treasurer' },
  { icon: 'payments', label: 'Member contributions', href: '/dashboard/treasurer/contributions' },
  { icon: 'account_balance', label: 'Financial ledger', href: '/dashboard/treasurer/ledger' },
  { icon: 'rule', label: 'Reconciliation', href: '/dashboard/treasurer/reconciliation' },
  { icon: 'assessment', label: 'Financial reports', href: '/financial-reports' },
  { icon: 'volunteer_activism', label: 'Welfare', href: '/dashboard/treasurer/welfare' },
  { icon: 'savings', label: 'My contributions', href: '/contributions' },
  ANNOUNCEMENTS_NAV,
]

export const SECRETARY_NAV: NavItem[] = [
  { icon: 'dashboard', label: 'Overview', href: '/dashboard/secretary' },
  ANNOUNCEMENTS_NAV,
  { icon: 'groups', label: 'Meetings', href: '/dashboard/secretary/meetings' },
  { icon: 'gavel', label: 'Governance', href: '/governance/manage' },
  { icon: 'folder_managed', label: 'Documents', href: '/documents/manage' },
  CONTRIBUTIONS_NAV,
]

export const ORGANIZER_NAV: NavItem[] = [
  { icon: 'dashboard', label: 'Overview', href: '/dashboard/organizer' },
  { icon: 'event', label: 'Events', href: '/dashboard/organizer/events' },
  { icon: 'photo_library', label: 'Gallery', href: '/dashboard/organizer/gallery' },
  { icon: 'work', label: 'Projects', href: '/dashboard/organizer/projects' },
  ANNOUNCEMENTS_NAV,
  CONTRIBUTIONS_NAV,
]

export const MEMBER_NAV: NavItem[] = [
  { icon: 'home', label: 'Home', href: '/dashboard/member' },
  ANNOUNCEMENTS_NAV,
  CONTRIBUTIONS_NAV,
  { icon: 'volunteer_activism', label: 'Welfare', href: '/dashboard/member/welfare' },
  { icon: 'folder', label: 'Documents', href: '/documents' },
  { icon: 'gavel', label: 'Governance', href: '/governance' },
]

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
    case 'MEMBER':
    default:
      return MEMBER_NAV
  }
}
