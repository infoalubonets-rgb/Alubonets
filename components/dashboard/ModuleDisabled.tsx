import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { requireActiveRole } from '@/lib/auth/session'
import { ROLE_HOME } from '@/lib/auth/types'
import { navForRole } from '@/lib/dashboard/nav'

export default async function ModuleDisabled({ module }: { module: 'Loans' | 'Welfare' }) {
  const actor = await requireActiveRole()
  return (
    <DashboardShell role={actor.role} title={module} nav={navForRole(actor.role)}>
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-outline-variant bg-surface p-8 text-center shadow-sm">
          <span className="material-symbols-outlined text-[44px] text-on-surface-variant">block</span>
          <h2 className="mt-3 font-h3 text-xl text-primary">This page is disabled</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            The {module} module is currently switched off. An administrator can turn it back on from Settings → Feature
            flags.
          </p>
          <Link
            href={ROLE_HOME[actor.role]}
            className="mt-5 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </DashboardShell>
  )
}
