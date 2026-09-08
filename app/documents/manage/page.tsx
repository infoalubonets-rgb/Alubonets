import DashboardShell from '@/components/dashboard/DashboardShell'
import AddDocumentModal from '@/components/documents/AddDocumentModal'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { ensureDocumentCategories } from '@/lib/document-categories'
import { syncExpiredDocuments } from '@/lib/documents'
import {
  createDocumentCategory,
  setSelectedDocumentStatus,
} from '@/app/actions/documents'

export default async function ManageDocumentsPage() {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY', 'ORGANIZER'])
  await Promise.all([ensureDocumentCategories(), syncExpiredDocuments()])
  const [categories, documents] = await Promise.all([
    prisma.documentCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.document.findMany({
      include: {
        categoryRecord: true,
        uploader: { select: { fullName: true } },
        downloads: { select: { id: true } },
      },
      orderBy: [{ uploadedAt: 'desc' }],
    }),
  ])

  return (
    <DashboardShell
      role={actor.role}
      title="Documents"
      nav={navForRole(actor.role)}
      hideRelatedLinks
      pageAction={<AddDocumentModal categories={categories} />}
    >
      <div className="space-y-5 p-4 md:p-6">
        <form action={setSelectedDocumentStatus}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-h3 text-xl text-primary">Your documents</h2>
            <div className="flex gap-2">
              <button
                name="status"
                value="DRAFT"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 px-4 py-2 text-xs font-label-bold text-primary"
              >
                <span className="material-symbols-outlined text-[17px]">visibility_off</span> Hide selected
              </button>
              <button
                name="status"
                value="PUBLISHED"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-label-bold text-on-primary"
              >
                <span className="material-symbols-outlined text-[17px]">publish</span> Publish selected
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {documents.map((document) => (
              <article
                key={document.id}
                className="flex items-start gap-3 rounded-2xl border border-outline-variant/60 bg-surface p-4 shadow-[0_4px_16px_rgba(0,31,80,0.05)]"
              >
                <input
                  type="checkbox"
                  name="documentIds"
                  value={document.id}
                  aria-label={`Select ${document.title}`}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary">
                  <span className="material-symbols-outlined">
                    {document.mimeType?.includes('pdf') ? 'picture_as_pdf' : 'description'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-label-bold text-primary">{document.title}</h3>
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        {document.categoryRecord?.name || 'Uncategorized'} · v{document.version}.0 ·{' '}
                        {document.downloads.length} downloads · {document.uploader.fullName}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[9px] font-label-bold uppercase tracking-wider ${
                        document.status === 'PUBLISHED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-secondary-container/10 text-secondary'
                      }`}
                    >
                      {document.status === 'PUBLISHED' ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`/api/documents/${document.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1.5 text-xs text-primary"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span> View
                    </a>
                    <button
                      name="singleId"
                      value={document.id}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary-container/10 px-3 py-1.5 text-xs font-label-bold text-secondary"
                      formAction={setSelectedDocumentStatus}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {document.status === 'PUBLISHED' ? 'visibility_off' : 'publish'}
                      </span>
                      {document.status === 'PUBLISHED' ? 'Hide' : 'Publish'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!documents.length && (
              <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-on-surface-variant">
                No documents added yet.
              </p>
            )}
          </div>
        </form>

        {actor.role === 'ADMIN' && (
          <details className="rounded-2xl border bg-surface p-4">
            <summary className="cursor-pointer text-sm font-label-bold text-primary">Add document category</summary>
            <form action={createDocumentCategory} className="mt-3 flex gap-2">
              <input name="name" required className="rounded-lg border px-3 py-2" />
              <button className="rounded-full bg-primary px-4 py-2 text-on-primary">Add</button>
            </form>
          </details>
        )}
      </div>
    </DashboardShell>
  )
}
