import Link from 'next/link'
import { requireActiveRole } from '@/lib/auth/session'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { navForRole } from '@/lib/dashboard/nav'
import { getActiveMonthsReport } from '@/lib/active-months-report'

export const dynamic = 'force-dynamic'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default async function ActiveMonthsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN', 'EXECUTIVE', 'AUDITOR'])
  const sp = await searchParams
  const currentYear = new Date().getUTCFullYear()
  const year = Number(sp.year) >= 2000 && Number(sp.year) <= currentYear + 1 ? Number(sp.year) : currentYear
  const report = await getActiveMonthsReport(year)
  const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - index)

  return (
    <DashboardShell role={actor.role} title="Active months" nav={navForRole(actor.role)}>
      <div className="space-y-6 p-4 md:p-6">
        <Link href="/financial-reports" className="text-sm text-primary underline">Financial reports</Link>
        <form className="flex flex-wrap items-end gap-2 rounded-xl border bg-surface p-4">
          <label className="text-sm">
            Year
            <select name="year" defaultValue={String(year)} className="block rounded-lg border px-3 py-2">
              {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button className="rounded-full bg-primary px-4 py-2 text-on-primary">Show</button>
          <a href={`/api/export/active-months?year=${year}`} className="rounded-full border px-4 py-2">Export CSV</a>
        </form>
        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-xl">Months paid per member, {year}</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            A month counts when its monthly fee
            {report.monthlyFeeKes > 0 ? ` (KES ${report.monthlyFeeKes.toLocaleString()})` : ''} is fully paid. Extra money carries into the next months.
            {report.annualFeeKes > 0 ? ' A full annual subscription covers 12 months.' : ''}
            {report.monthlyFeeKes <= 0 ? ' No monthly fee is set in Admin finance settings, so any monthly payment counts.' : ''}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2">Member</th>
                  {MONTH_SHORT.map((label) => <th key={label} className="px-1 text-center">{label}</th>)}
                  <th className="text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.userId} className="border-t">
                    <td className="py-2">
                      {row.fullName}
                      {row.standing === 'LAPSED' ? <span className="ml-1 rounded bg-error/10 px-1 text-xs text-error">Lapsed</span> : null}
                    </td>
                    {row.months.map((paid, index) => (
                      <td key={index} className="px-1 text-center">
                        {paid ? <span className="text-emerald-700" title="Paid">●</span> : <span className="text-on-surface-variant/40" title="Not paid">○</span>}
                      </td>
                    ))}
                    <td className="text-center font-semibold">{row.activeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}
