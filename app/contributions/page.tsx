import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { navForRole } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { createClient } from '@/utils/supabase/server'
import type { Role } from '@/lib/auth/types'
import ContributionsClient from '@/components/dashboard/ContributionsClient'

export const metadata = { title: 'My contributions' }

export default async function ContributionsPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login?next=/contributions')
  if (profile.status === 'SUSPENDED') redirect('/login?error=suspended')

  const role = profile.role as Role
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: contributions } = await supabase
    .from('contributions')
    .select('id, amount, paidAt, category')
    .eq('userId', profile.id)
    .order('paidAt', { ascending: false })

  return (
    <DashboardShell role={role} title="My contributions" nav={navForRole(role)}>
      <ContributionsClient
        contributions={(contributions ?? []).map((c) => ({
          id: c.id,
          amount: c.amount,
          paidAt: c.paidAt as string,
          category: c.category ?? null,
        }))}
        userId={profile.id}
      />
    </DashboardShell>
  )
}
