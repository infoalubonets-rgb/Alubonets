import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import ExecutiveProfilesTable from '@/components/admin/ExecutiveProfilesTable'
import { requireAdmin } from '@/lib/auth/session'
import { navWithLoans } from '@/lib/dashboard/nav-async'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'About Us profiles — Alubonets' }

export default async function AboutProfilesPage() {
  await requireAdmin()
  const [executives, profiles, nav] = await Promise.all([
    prisma.user.findMany({ where: { OR: [{ role: 'EXECUTIVE' }, { dashboardAccess: { has: 'EXECUTIVE' } }] }, orderBy: [{ aboutOrder: 'asc' }, { fullName: 'asc' }], include: { memberProfile: { select: { profession: true, skills: true, educationLevel: true, achievements: true, mentorshipArea: true, interests: true } } } }),
    prisma.committeeProfile.findMany({ where: { userId: { not: null } }, orderBy: { updatedAt: 'desc' } }),
    navWithLoans('ADMIN'),
  ])
  const rows = await Promise.all(executives.map(async user => {
    const profile = profiles.find(p => p.userId === user.id)
    let photoUrl = user.avatarUrl
    if (photoUrl && !photoUrl.startsWith('http')) {
      try { photoUrl = (await createServerClient().storage.from('member-avatars').createSignedUrl(photoUrl, 3600)).data?.signedUrl || null } catch { photoUrl = null }
    }
    return { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, location: user.location, profession: user.memberProfile?.profession || null, extraDetails: { Skills: user.memberProfile?.skills || null, Education: user.memberProfile?.educationLevel?.replaceAll('_', ' ') || null, Achievements: user.memberProfile?.achievements || null, Mentorship: user.memberProfile?.mentorshipArea || null, Interests: user.memberProfile?.interests || null }, photoUrl, status: user.status, biography: profile?.biography || '', responsibilities: profile?.responsibilities || '', about: { show: user.showOnAbout, title: user.aboutTitle || null, order: user.aboutOrder, fields: user.publicProfileFields } }
  }))
  return <DashboardShell role="ADMIN" title="About Us profiles" nav={nav} hideRelatedLinks pageAction={<div className="flex gap-2"><Link href="/directory" className="rounded-full border px-4 py-2">Members</Link><Link href="/about" target="_blank" className="rounded-full border px-4 py-2">View About page</Link><Link href="/admin/roles" className="rounded-full bg-secondary-container px-4 py-2 font-semibold text-on-primary">+ Add executive</Link></div>}><ExecutiveProfilesTable rows={rows} /></DashboardShell>
}
