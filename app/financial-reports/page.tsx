import { requireActiveRole } from '@/lib/auth/session'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { navForRole } from '@/lib/dashboard/nav'
import { REPORT_KINDS, buildReport, parseReportFilters, reportCampaigns } from '@/lib/reports'
import { appTodayInputValue } from '@/lib/dates'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Financial reports' }

/**
 * Financial reports, kept minimal: pick a report and its filters, read four KPI cards, view the
 * report as a table (collapsible) and download exactly that as PDF, Word or CSV.
 */
export default async function FinancialReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActiveRole(['TREASURER', 'ADMIN', 'EXECUTIVE', 'AUDITOR'])
  const filters = parseReportFilters(await searchParams)
  const [report, campaigns] = await Promise.all([buildReport(filters), filters.kind === 'arrears' ? reportCampaigns() : Promise.resolve([])])

  const query = new URLSearchParams({ report: filters.kind })
  if (filters.kind === 'monthly') query.set('year', String(filters.year))
  if (filters.kind === 'arrears' && filters.campaign) query.set('campaign', filters.campaign)
  if (filters.kind === 'transactions') {
    if (filters.from) query.set('from', filters.from)
    if (filters.to) query.set('to', filters.to)
    query.set('direction', filters.direction)
  }
  const download = (format: string) => `/api/export/report?${query.toString()}&format=${format}`
  const thisYear = Number(appTodayInputValue().slice(0, 4))
  const field = 'mt-1 block h-10 rounded-xl border border-outline-variant bg-surface px-3 text-sm font-normal text-on-surface'

  return (
    <DashboardShell role={actor.role} title="Financial reports" nav={navForRole(actor.role)}>
      <div className="mx-auto max-w-7xl space-y-5 p-3 sm:p-4 md:p-6">
        <form method="get" className="flex flex-wrap items-end gap-2 rounded-2xl border border-outline-variant bg-surface p-3">
          <label className="text-xs font-semibold text-on-surface-variant">
            Report
            <select name="report" defaultValue={filters.kind} className={field}>
              {REPORT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </label>
          {filters.kind === 'monthly' && (
            <label className="text-xs font-semibold text-on-surface-variant">
              Year
              <select name="year" defaultValue={filters.year} className={field}>
                {Array.from({ length: 6 }, (_, i) => thisYear - i).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          )}
          {filters.kind === 'arrears' && (
            <label className="text-xs font-semibold text-on-surface-variant">
              Campaign
              <select name="campaign" defaultValue={filters.campaign} className={field}>
                <option value="">All campaigns</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
          )}
          {filters.kind === 'transactions' && (
            <>
              <label className="text-xs font-semibold text-on-surface-variant">From<input type="date" name="from" defaultValue={filters.from} className={field} /></label>
              <label className="text-xs font-semibold text-on-surface-variant">To<input type="date" name="to" defaultValue={filters.to} className={field} /></label>
              <label className="text-xs font-semibold text-on-surface-variant">
                Show
                <select name="direction" defaultValue={filters.direction} className={field}>
                  <option value="all">Money in and out</option>
                  <option value="in">Money in</option>
                  <option value="out">Money out</option>
                </select>
              </label>
            </>
          )}
          <button className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">Show report</button>
          <div className="ml-auto flex flex-wrap gap-2">
            {[
              { format: 'pdf', label: 'PDF', icon: 'picture_as_pdf' },
              { format: 'docx', label: 'Word', icon: 'description' },
              { format: 'csv', label: 'CSV', icon: 'table_view' },
            ].map((d) => (
              <a key={d.format} href={download(d.format)} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-outline-variant px-3 text-sm font-semibold text-primary hover:bg-primary/5">
                <span className="material-symbols-outlined text-[18px]">{d.icon}</span>
                {d.label}
              </a>
            ))}
          </div>
        </form>

        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {report.kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-2xl border border-outline-variant bg-surface p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{kpi.label}</p>
              <p className="mt-1 truncate text-xl font-bold text-primary">{kpi.value}</p>
            </div>
          ))}
        </div>

        <details open className="group rounded-2xl border border-outline-variant bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block font-h3 text-lg text-primary">{report.title}</span>
              <span className="block text-xs text-on-surface-variant">{report.subtitle} · {report.rows.length} row{report.rows.length === 1 ? '' : 's'}</span>
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant text-primary" aria-hidden="true">
              <span className="material-symbols-outlined text-[22px] group-open:hidden">expand_more</span>
              <span className="material-symbols-outlined hidden text-[22px] group-open:inline">expand_less</span>
            </span>
          </summary>
          <div className="max-h-[70vh] overflow-auto border-t border-outline-variant">
            <table className="w-full border-separate border-spacing-0 text-sm" style={{ minWidth: report.columns.length > 10 ? 1100 : 640 }}>
              <thead className="sticky top-0 z-10 bg-surface-container-low text-[11px] uppercase tracking-wide text-on-surface-variant">
                <tr>
                  {report.columns.map((c, i) => (
                    <th key={c.label} className={`border-b border-outline-variant px-3 py-2 ${c.align === 'right' ? 'text-right' : 'text-left'} ${i === 0 ? 'sticky left-0 z-20 bg-surface-container-low' : ''}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 && (
                  <tr><td colSpan={report.columns.length} className="py-10 text-center text-on-surface-variant">No data for these filters.</td></tr>
                )}
                {report.rows.map((cells, r) => (
                  <tr key={r} className="hover:bg-primary/[0.03]">
                    {cells.map((cell, i) => (
                      <td key={i} className={`border-b border-outline-variant/40 px-3 py-1.5 tabular-nums ${report.columns[i]?.align === 'right' ? 'text-right' : ''} ${i === 0 ? 'sticky left-0 bg-surface font-medium' : ''} ${cell === '—' ? 'text-outline' : ''}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {report.totals && report.rows.length > 0 && (
                <tfoot className="sticky bottom-0 bg-surface-container-low font-bold">
                  <tr>
                    {report.totals.map((cell, i) => (
                      <td key={i} className={`border-t border-outline-variant px-3 py-2 tabular-nums ${report.columns[i]?.align === 'right' ? 'text-right' : ''} ${i === 0 ? 'sticky left-0 bg-surface-container-low' : ''}`}>{cell}</td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </details>
      </div>
    </DashboardShell>
  )
}
