import DashboardShell from '@/components/dashboard/DashboardShell'
import ContactInbox from '@/components/admin/ContactInbox'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
export const dynamic = 'force-dynamic'
export default function Page(){return <DashboardShell role="ADMIN" title="Contact inbox" nav={ADMIN_NAV}><ContactInbox canConfigure /></DashboardShell>}
