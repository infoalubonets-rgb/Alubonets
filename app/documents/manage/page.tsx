import DashboardShell from '@/components/dashboard/DashboardShell'
import AddDocumentModal from '@/components/documents/AddDocumentModal'
import ManageDocumentsList from '@/components/documents/ManageDocumentsList'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { ensureDocumentCategories } from '@/lib/document-categories'
import { syncExpiredDocuments } from '@/lib/documents'
import { createDocumentCategory } from '@/app/actions/documents'

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
        <ManageDocumentsList
          documents={documents.map((document) => ({
            id: document.id,
            title: document.title,
            status: document.status,
            version: document.version,
            mimeType: document.mimeType,
            categoryName: document.categoryRecord?.name || 'Uncategorized',
            uploaderName: document.uploader.fullName,
            downloadCount: document.downloads.length,
          }))}
        />

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
