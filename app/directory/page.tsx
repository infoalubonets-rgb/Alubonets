import Link from 'next/link'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import DirectoryClient from '@/components/dashboard/DirectoryClient'
import DirectoryFilters from '@/components/dashboard/DirectoryFilters'
import NewMemberButton from '@/components/admin/NewMemberButton'
import { navForRole } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { getDirectoryMembers } from '@/app/actions/directory'
import { prisma } from '@/lib/prisma'
import { canViewMemberDirectory } from '@/lib/directory'
import type { Role } from '@/lib/auth/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Members — Alubonets' }

const HEADER_BUTTON =
  'inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-label-bold text-on-primary shadow-[0_3px_10px_rgba(0,31,80,0.18)] transition active:scale-[0.98]'

/** The one members page for every role; admins also manage accounts from here. */
export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; filter?: string }>
}) {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login?next=/directory')
  if (profile.status !== 'ACTIVE') redirect('/login?error=inactive')
  if (!canViewMemberDirectory(profile)) redirect(navForRole(profile.role as Role)[0]?.href ?? '/dashboard/member')

  const sp = await searchParams
  // Old single-dropdown links (?filter=status:ACTIVE) become the matching separate filter.
  const legacy = /^(type|role|status):(.+)$/.exec(sp.filter ?? '')
  if (legacy) {
    const next = new URLSearchParams()
    if (sp.q) next.set('q', sp.q)
    next.set(legacy[1], legacy[2])
    redirect(`/directory?${next}`)
  }

  const isAdmin = profile.role === 'ADMIN' || profile.isSuperAdmin
  // A Secretary/Treasurer/etc. who is also an Executive reaches Members through the Executive menu.
  const navRole: Role = navForRole(profile.role as Role).some((item) => item.href === '/directory')
    ? (profile.role as Role)
    : 'EXECUTIVE'
  const [members, pendingApprovals] = await Promise.all([
    getDirectoryMembers(),
    isAdmin ? prisma.user.count({ where: { status: 'PENDING', rejectedAt: null } }) : Promise.resolve(0),
  ])

  return (
    <DashboardShell
      role={navRole}
      title="Members"
      nav={navForRole(navRole)}
      hideRelatedLinks={isAdmin}
      pageAction={
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <DirectoryFilters isAdmin={isAdmin} />
          {isAdmin && (
          <>
            <a href="/api/export/members" className={`${HEADER_BUTTON} bg-primary hover:opacity-90`}>
              <span className="material-symbols-outlined text-[16px]">download</span>
              Export
            </a>
            <Link href="/admin/roles" className={`${HEADER_BUTTON} bg-primary hover:opacity-90`}>
              <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              Roles
            </Link>
            <Link href="/admin/approvals" className={`${HEADER_BUTTON} bg-secondary-container hover:opacity-90`}>
              <span className="material-symbols-outlined text-[16px]">pending_actions</span>
              Approvals
              {pendingApprovals > 0 && (
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] leading-none text-secondary">{pendingApprovals}</span>
              )}
            </Link>
            <NewMemberButton
              canAddAdmins={Boolean(profile.isSuperAdmin)}
              className={`${HEADER_BUTTON} bg-secondary-container hover:opacity-90`}
              principals={members
                .filter((member) => member.isPrincipal && member.account?.status === 'ACTIVE')
                .map((member) => ({ id: member.id, fullName: member.fullName }))}
            />
          </>
          )}
        </div>
      }
    >
      <DirectoryClient members={members} initialQuery={sp.q ?? ''} />
    </DashboardShell>
  )
}
