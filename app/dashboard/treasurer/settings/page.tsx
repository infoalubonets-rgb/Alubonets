import DashboardShell from '@/components/dashboard/DashboardShell'
import { TREASURER_NAV } from '@/lib/dashboard/nav'
import { requireActiveRole } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { filterAdminManagedCategories } from '@/lib/payment-categories'
import ContributionCategoriesManager from '@/components/admin/ContributionCategoriesManager'
import { PurposeSettingsEditor } from '@/components/finance/PurposeSettingsEditor'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Finance settings' }
export default async function FinanceSettingsPage() {
  const actor = await requireActiveRole(['ADMIN', 'TREASURER'])
  const categories = await prisma.transactionCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
  return <DashboardShell role={actor.role} title="Finance settings" nav={TREASURER_NAV}>
    <div className="space-y-6 pt-4">
      <section className="rounded-2xl border border-outline-variant bg-surface p-5"><h2 className="mb-5 text-lg font-semibold">Contribution purposes</h2><PurposeSettingsEditor key={categories.map(c => `${c.id}:${c.billingKind}`).join('|')} /></section>
      <section className="rounded-2xl border border-outline-variant bg-surface p-5"><h2 className="mb-4 text-lg font-semibold">Manage categories</h2><ContributionCategoriesManager categories={filterAdminManagedCategories(categories).map(c => ({ id: c.id, name: c.name, type: c.type, billingKind: c.billingKind, system: false }))} /></section>
    </div>
  </DashboardShell>
}
