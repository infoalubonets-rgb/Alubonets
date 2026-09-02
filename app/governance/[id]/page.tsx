import { notFound } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import GovernanceRecordDetailView from '@/components/governance/GovernanceRecordDetailView'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { getGovernanceRecordForViewer } from '@/lib/data/queries'

export default async function GovernanceRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await requireActiveRole([
    'ADMIN',
    'SECRETARY',
    'EXECUTIVE',
    'TREASURER',
    'ORGANIZER',
    'MEMBER',
  ])
  const record = await getGovernanceRecordForViewer(id, actor)
  if (!record) notFound()

  return (
    <DashboardShell role={actor.role} title="Governance" nav={navForRole(actor.role)}>
      <div className="p-4 md:p-6">
        <GovernanceRecordDetailView record={record} />
      </div>
    </DashboardShell>
  )
}
