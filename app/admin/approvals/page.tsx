import DashboardShell from '@/components/dashboard/DashboardShell'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { setMemberApproval } from '@/app/actions/members'
import { prisma } from '@/lib/prisma'

export default async function AdminApprovalsPage() {
  const pending = await prisma.user.findMany({
    where: { status: 'PENDING', rejectedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      memberProfile: true,
      consentRecords: { orderBy: { acceptedAt: 'desc' }, take: 1 },
    },
  })

  return (
    <DashboardShell role="ADMIN" title="Approvals" nav={ADMIN_NAV}>
      <div className="space-y-4 p-4 md:p-6">
        <p className="text-sm text-on-surface-variant">
          Review the complete application. Approval assigns the next membership number; rejection is permanent.
        </p>
        {pending.length === 0 && <p className="rounded-xl border bg-surface p-4 text-sm text-on-surface-variant">No pending members.</p>}
        {pending.map((user) => {
          const profile = user.memberProfile
          const fields: [string, string | null | undefined][] = profile ? [
            ['Gender', profile.gender],
            ['Date of birth', profile.dateOfBirth?.toLocaleDateString()],
            ['Address', profile.address],
            ['Family branch', profile.familyBranch],
            ['Member category', profile.memberCategory?.replaceAll('_', ' ')],
            ['Next of kin', `${profile.nextOfKinName} · ${profile.nextOfKinPhone} · ${profile.nextOfKinRelationship}`],
            ['Emergency contact', `${profile.emergencyContactName} · ${profile.emergencyContactPhone}`],
            ['Profession', profile.profession],
            ['Education', profile.educationLevel],
            ['Skills', profile.skills],
            ['Achievements', profile.achievements],
            ['Mentorship area', profile.mentorshipArea],
            ['Interests', profile.interests],
          ] : []
          return (
            <article key={user.id} className="space-y-4 rounded-xl border border-outline-variant/30 bg-surface p-4">
              <header>
                <p className="font-medium">{user.fullName}</p>
                <p className="text-sm text-on-surface-variant">{user.email} · {user.phone}</p>
                <p className="text-xs text-on-surface-variant">Registered {user.createdAt.toLocaleString()}</p>
              </header>
              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {fields.map(([title, value]) => <div key={title} className="rounded-lg bg-surface-container-low p-3"><dt className="text-xs uppercase text-on-surface-variant">{title}</dt><dd className="mt-1 whitespace-pre-wrap">{value || '—'}</dd></div>)}
              </dl>
              <p className="text-xs text-on-surface-variant">
                Consent: {user.consentRecords[0] ? `${user.consentRecords[0].termsVersion}, accepted ${user.consentRecords[0].acceptedAt.toLocaleString()}` : 'No consent record'}
              </p>
              <form className="space-y-3 border-t pt-4" action={async (formData) => {
                'use server'
                await setMemberApproval({
                  userId: user.id,
                  approve: formData.get('decision') === 'approve',
                  note: String(formData.get('note') || ''),
                  identityVerified: formData.get('identityVerified') === 'on',
                })
              }}>
                <label className="block text-sm">Approval note or permanent rejection reason<textarea name="note" required minLength={3} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="identityVerified" />Identity details have been verified</label>
                <div className="flex flex-wrap gap-2">
                  <button name="decision" value="approve" className="rounded-lg bg-primary px-4 py-2 text-sm text-on-primary">Approve and assign number</button>
                  <button name="decision" value="reject" className="rounded-lg border border-error px-4 py-2 text-sm text-error">Reject permanently</button>
                </div>
              </form>
            </article>
          )
        })}
      </div>
    </DashboardShell>
  )
}
