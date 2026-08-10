import DashboardShell from '@/components/dashboard/DashboardShell'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { setSelectedDocumentStatus, uploadReport } from '@/app/actions/documents'

export const metadata = { title: 'Manage reports' }

export default async function ManageReportsPage() {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY'])
  const reports = await prisma.document.findMany({
    where: { category: 'Reports' },
    include: { uploader: { select: { fullName: true } } },
    orderBy: { uploadedAt: 'desc' },
  })

  return (
    <DashboardShell role={actor.role} title="Reports" nav={navForRole(actor.role)}>
      <div className="space-y-5">
        <details className="rounded-2xl border bg-surface p-4">
          <summary className="cursor-pointer list-none font-label-bold text-primary">
            <span className="inline-flex items-center gap-2"><span className="material-symbols-outlined text-secondary-container">add_circle</span>Add new report</span>
          </summary>
          <form action={uploadReport} className="mt-4 grid gap-3 border-t border-outline-variant/40 pt-4 md:grid-cols-2">
            <input name="title" required placeholder="Report title" className="rounded-xl border px-3 py-2.5" />
            <input name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.csv" className="rounded-xl border px-3 py-2.5 text-sm" />
            <textarea name="description" rows={4} placeholder="Report description or comments" className="rounded-xl border px-3 py-2.5 md:col-span-2" />
            <div className="flex gap-2 md:col-span-2">
              <button name="status" value="DRAFT" className="rounded-full border border-primary px-4 py-2 text-sm text-primary">Save draft</button>
              <button name="status" value="PUBLISHED" className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-4 py-2 text-sm font-label-bold text-on-primary">
                <span className="material-symbols-outlined text-[17px]">publish</span>Publish report
              </button>
            </div>
            <p className="text-xs text-on-surface-variant md:col-span-2">Accepted: PDF, Word, Excel, and CSV. Maximum 15 MB.</p>
          </form>
        </details>

        <form action={setSelectedDocumentStatus}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-h3 text-lg text-primary">All reports</h2>
            <div className="flex gap-2">
              <button name="status" value="DRAFT" className="rounded-full border px-3 py-2 text-xs text-primary">Hide selected</button>
              <button name="status" value="PUBLISHED" className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs text-on-primary"><span className="material-symbols-outlined text-[15px]">publish</span>Publish selected</button>
            </div>
          </div>
          <div className="space-y-3">
            {reports.map((report) => (
              <article key={report.id} className="flex items-start gap-3 rounded-2xl border bg-surface p-4">
                <input type="checkbox" name="documentIds" value={report.id} aria-label={`Select ${report.title}`} className="mt-1 h-4 w-4 accent-primary" />
                <span className="material-symbols-outlined text-primary">assessment</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap justify-between gap-2"><b>{report.title}</b><span className="text-xs text-on-surface-variant">{report.status}</span></div>
                  {report.description && <p className="mt-1 text-sm text-on-surface-variant">{report.description}</p>}
                  <p className="mt-1 text-xs text-on-surface-variant">{report.uploader.fullName} · {report.uploadedAt.toLocaleDateString()}</p>
                  <div className="mt-3 flex gap-2">
                    <a href={`/api/documents/${report.id}/download`} target="_blank" rel="noreferrer" className="rounded-full border px-3 py-1.5 text-xs text-primary">View</a>
                    <button name="singleId" value={report.id} formAction={setSelectedDocumentStatus} className="inline-flex items-center gap-1 rounded-full bg-secondary-container/10 px-3 py-1.5 text-xs font-label-bold text-secondary">
                      <span className="material-symbols-outlined text-[15px]">{report.status === 'PUBLISHED' ? 'visibility_off' : 'publish'}</span>{report.status === 'PUBLISHED' ? 'Hide' : 'Publish'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!reports.length && <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-on-surface-variant">No reports yet.</p>}
          </div>
        </form>
      </div>
    </DashboardShell>
  )
}
