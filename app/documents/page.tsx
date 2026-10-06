import RecordDeletionControls, { RecordSelection, DeleteRecordButton } from '@/components/documents/RecordDeletionControls'
import DashboardShell from '@/components/dashboard/DashboardShell'
import AddDocumentModal from '@/components/documents/AddDocumentModal'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { canReadDocument, syncExpiredDocuments } from '@/lib/documents'
import { ensureDocumentCategories } from '@/lib/document-categories'
import PaginationBar from '@/components/ui/PaginationBar'
import { parsePage, paginationSkip, totalPages } from '@/lib/pagination'

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; tag?: string; page?: string }>
}) {
  const actor = await requireActiveRole([
    'ADMIN',
    'SECRETARY',
    'EXECUTIVE',
    'TREASURER',
    'ORGANIZER',
    'MEMBER',
    'AUDITOR',
  ])
  await Promise.all([ensureDocumentCategories(), syncExpiredDocuments()])
  const { q = '', category = '', tag = '', page: pageRaw } = await searchParams
  const page = parsePage(pageRaw)
  const pageSize = 24
  const canAdd = actor.isSuperAdmin || actor.role === 'ADMIN' || actor.role === 'SECRETARY'
  const [documents, categories] = await Promise.all([
    prisma.document.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { tags: { has: q } },
              ],
            }
          : {}),
        ...(category ? { categoryId: category } : {}),
        ...(tag ? { tags: { has: tag } } : {}),
        status: 'PUBLISHED',
      },
      include: { categoryRecord: true, uploader: { select: { fullName: true } } },
      orderBy: [{ uploadedAt: 'desc' }],
      take: 500,
    }),
    prisma.documentCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])
  const visible = documents.filter((document) => canReadDocument(document, actor.role))
  const latest = visible.filter(
    (document, index, all) =>
      all.findIndex((item) => item.versionGroupId === document.versionGroupId) === index,
  )
  const pages = totalPages(latest.length, pageSize)
  const pageItems = latest.slice(paginationSkip(page, pageSize), paginationSkip(page, pageSize) + pageSize)

  return (
    <DashboardShell
      role={actor.role}
      title="Document repository"
      nav={navForRole(actor.role)}
      hideRelatedLinks
      pageAction={canAdd ? <AddDocumentModal categories={categories} /> : undefined}
    >
      <div className="space-y-5 p-4 md:p-6">
        <form className="flex min-w-0 flex-wrap gap-2 rounded-xl border bg-surface p-2.5">
          <label className="relative min-w-[190px] flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant">
              search
            </span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Search documents"
              className="h-10 w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <select name="category" defaultValue={category} className="h-10 rounded-lg border px-3 py-2 text-sm">
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            name="tag"
            defaultValue={tag}
            placeholder="Tag"
            className="h-10 w-28 rounded-lg border px-3 py-2 text-sm"
          />
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary"
            aria-label="Search documents"
            title="Search"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
          </button>
        </form>
        <RecordDeletionControls enabled={canAdd} records={pageItems.map(document => ({ id: document.id, kind: 'DOCUMENT' as const, title: document.title }))}>
        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden shadow-[0_4px_12px_rgba(20,32,51,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left bg-surface-container-low border-b border-outline-variant">
                  {canAdd && <th className="px-4 py-3"><span className="sr-only">Select document</span></th>}
                  {['Document', 'Category', 'Version', 'Access', 'Published'].map((heading) => (
                    <th
                      key={heading}
                      className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant"
                    >
                      {heading}
                    </th>
                  ))}
                  <th className="py-3 px-4 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant text-right w-24">
                    {canAdd ? 'Actions' : 'View'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={canAdd ? 7 : 6} className="py-10 text-center text-on-surface-variant">
                      No documents found.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((document, i) => (
                    <tr
                      key={document.id}
                      className={`border-t border-outline-variant/50 align-top hover:bg-primary/[0.03] transition-colors ${
                        i % 2 === 1 ? 'bg-surface-container-low/40' : ''
                      }`}
                    >
                      {canAdd && <td className="py-3.5 px-4"><RecordSelection record={{ id: document.id, kind: 'DOCUMENT', title: document.title }} /></td>}
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-on-surface">{document.title}</p>
                        {document.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-on-surface-variant">{document.description}</p>
                        )}
                        {!!document.tags?.length && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {document.tags.map((item) => (
                              <a
                                key={item}
                                href={`/documents?tag=${encodeURIComponent(item)}`}
                                className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] text-on-surface-variant"
                              >
                                #{item}
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant">
                        {document.categoryRecord?.name || document.category || 'Uncategorized'}
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant">{document.version}.0</td>
                      <td className="py-3.5 px-4">
                        <span className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                          {document.accessLevel.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant">
                        <p className="whitespace-nowrap">{document.uploadedAt.toLocaleDateString()}</p>
                        <p className="text-xs">by {document.uploader.fullName}</p>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex justify-end gap-2">
                        <a
                          href={`/api/documents/${document.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-xs text-on-primary"
                        >
                          View
                        </a>
                        {canAdd && <DeleteRecordButton record={{ id: document.id, kind: 'DOCUMENT', title: document.title }} />}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </RecordDeletionControls>
        <PaginationBar pathname="/documents" page={page} totalPages={pages} params={{ q, category, tag }} />
      </div>
    </DashboardShell>
  )
}
