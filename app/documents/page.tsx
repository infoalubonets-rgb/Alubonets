import Link from 'next/link'
import DashboardShell from '@/components/dashboard/DashboardShell'
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
  searchParams: Promise<{ q?: string; category?: string; status?: string; page?: string }>
}) {
  const actor = await requireActiveRole([
    'ADMIN',
    'SECRETARY',
    'EXECUTIVE',
    'TREASURER',
    'ORGANIZER',
    'MEMBER',
  ])
  await Promise.all([ensureDocumentCategories(), syncExpiredDocuments()])
  const { q = '', category = '', status = '', page: pageRaw } = await searchParams
  const page = parsePage(pageRaw)
  const pageSize = 24
  const staff = actor.role === 'ADMIN' || actor.role === 'SECRETARY'
  const [documents, categories] = await Promise.all([
    prisma.document.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(category ? { categoryId: category } : {}),
        ...(status
          ? { status: status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'EXPIRED' }
          : staff
            ? {}
            : { status: 'PUBLISHED' }),
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
    <DashboardShell role={actor.role} title="Document repository" nav={navForRole(actor.role)}>
      <div className="space-y-5 p-4 md:p-6">
        <form className="grid gap-2 rounded-2xl border bg-surface p-4 md:grid-cols-4">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title or description"
            className="rounded-lg border px-3 py-2"
          />
          <select name="category" defaultValue={category} className="rounded-lg border px-3 py-2">
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {staff && (
            <select name="status" defaultValue={status} className="rounded-lg border px-3 py-2">
              <option value="">All statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
              <option value="EXPIRED">Expired</option>
            </select>
          )}
          <button className="w-fit rounded-full bg-primary px-4 py-2 text-on-primary">Search</button>
        </form>
        <div className="grid gap-3 md:grid-cols-2">
          {pageItems.map((document) => (
            <article key={document.id} className="rounded-2xl border bg-surface p-5">
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="font-h3 text-lg text-primary">{document.title}</h2>
                  <p className="text-sm text-on-surface-variant">
                    {document.categoryRecord?.name || document.category || 'Uncategorized'} · Version{' '}
                    {document.version}.0 · {document.status}
                  </p>
                </div>
                <span className="h-fit rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                  {document.accessLevel.replaceAll('_', ' ')}
                </span>
              </div>
              {document.description && <p className="mt-3 text-sm">{document.description}</p>}
              <p className="mt-2 text-xs text-on-surface-variant">
                Published {document.uploadedAt.toLocaleDateString()} by {document.uploader.fullName}
              </p>
              <Link
                href={`/api/documents/${document.id}/download`}
                className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm text-on-primary"
              >
                Download
              </Link>
            </article>
          ))}
        </div>
        {!pageItems.length && (
          <p className="rounded-xl border bg-surface p-5 text-sm">
            No authorized documents match your search.
          </p>
        )}
        <PaginationBar
          pathname="/documents"
          page={page}
          totalPages={pages}
          params={{ q, category, status }}
        />
      </div>
    </DashboardShell>
  )
}
