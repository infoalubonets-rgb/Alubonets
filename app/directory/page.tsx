import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import DirectoryClient from '@/components/dashboard/DirectoryClient'
import { navForRole } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { getDirectoryMembers } from '@/app/actions/directory'
import type { Role } from '@/lib/auth/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Member directory — Alubonets' }

export default async function DirectoryPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login?next=/directory')
  if (profile.status !== 'ACTIVE') redirect('/login?error=inactive')

  const members = await getDirectoryMembers()

  return (
    <DashboardShell role={profile.role as Role} title="Member directory" nav={navForRole(profile.role as Role)}>
      <DirectoryClient members={members} />
    </DashboardShell>
  )
}
