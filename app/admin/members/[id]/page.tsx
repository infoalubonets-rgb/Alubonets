import { notFound } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'

export default async function AdminMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      memberProfile: true,
      consentRecords: { orderBy: { acceptedAt: 'desc' } },
      loginEvents: { orderBy: { createdAt: 'desc' }, take: 100 },
      auditLogs: { orderBy: { createdAt: 'desc' }, take: 100 },
    },
  })
  if (!user) notFound()
  const profile = user.memberProfile
  const details: [string, unknown][] = [
    ['Membership number', user.membershipNumber],
    ['Role', user.role],
    ['Status', user.status],
    ['Member category', profile?.memberCategory],
    ['Identity verification', user.identityVerificationStatus],
    ['Email', user.email],
    ['Phone', user.phone],
    ['Date of birth', profile?.dateOfBirth?.toLocaleDateString()],
    ['Gender', profile?.gender],
    ['Address', profile?.address],
    ['Family branch', profile?.familyBranch],
    ['Next of kin', `${profile?.nextOfKinName || ''} · ${profile?.nextOfKinPhone || ''} · ${profile?.nextOfKinRelationship || ''}`],
    ['Emergency contact', `${profile?.emergencyContactName || ''} · ${profile?.emergencyContactPhone || ''}`],
    ['Profession', profile?.profession],
    ['Education', profile?.educationLevel],
    ['Skills', profile?.skills],
    ['Achievements', profile?.achievements],
    ['Mentorship area', profile?.mentorshipArea],
    ['Interests', profile?.interests],
    ['Approval notes', user.approvalNotes],
    ['Rejection reason', user.rejectionReason],
  ]
  return <DashboardShell role="ADMIN" title={user.fullName} nav={ADMIN_NAV}><div className="space-y-6 p-4 md:p-6"><section className="rounded-2xl border bg-surface p-5"><h2 className="font-h3 text-xl text-primary">Application and membership</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{details.map(([title, value]) => <div key={title} className="rounded-lg bg-surface-container-low p-3"><dt className="text-xs uppercase text-on-surface-variant">{title}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{String(value || '—')}</dd></div>)}</dl></section><Timeline title="Application and membership history" items={user.auditLogs.map((item) => ({ id: item.id, title: item.action, detail: item.meta ? JSON.stringify(item.meta) : '', date: item.createdAt }))} /><Timeline title="Login history" items={user.loginEvents.map((item) => ({ id: item.id, title: item.success ? 'Successful login' : 'Failed login', detail: [item.reason, item.ipAddress, item.userAgent].filter(Boolean).join(' · '), date: item.createdAt }))} /><Timeline title="Consent history" items={user.consentRecords.map((item) => ({ id: item.id, title: `Terms ${item.termsVersion} / Privacy ${item.privacyVersion}`, detail: item.ipAddress || '', date: item.acceptedAt }))} /></div></DashboardShell>
}

function Timeline({ title, items }: { title: string; items: { id: string; title: string; detail: string; date: Date }[] }) {
  return <section className="rounded-2xl border bg-surface p-5"><h2 className="font-h3 text-xl text-primary">{title}</h2>{items.length === 0 ? <p className="mt-3 text-sm text-on-surface-variant">No records yet.</p> : <ol className="mt-4 space-y-3">{items.map((item) => <li key={item.id} className="border-l-2 border-secondary-container pl-3"><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-on-surface-variant">{item.date.toLocaleString()}{item.detail ? ` · ${item.detail}` : ''}</p></li>)}</ol>}</section>
}
