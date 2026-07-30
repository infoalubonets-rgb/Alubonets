import DashboardShell from '@/components/dashboard/DashboardShell'
import ContactInbox from '@/components/admin/ContactInbox'
import { EXECUTIVE_NAV } from '@/lib/dashboard/nav'
export const dynamic = 'force-dynamic'
export default function Page(){return <DashboardShell role="EXECUTIVE" title="Contact inbox" nav={EXECUTIVE_NAV}><ContactInbox /></DashboardShell>}
