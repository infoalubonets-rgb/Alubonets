import DashboardShell from '@/components/dashboard/DashboardShell'
import AddDocumentModal from '@/components/documents/AddDocumentModal'
import ManageDocumentsList from '@/components/documents/ManageDocumentsList'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { ensureDemoDocument, ensureDocumentCategories } from '@/lib/document-categories'
import { syncExpiredDocuments } from '@/lib/documents'

export default async function ManageDocumentsPage() {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY', 'ORGANIZER'])
  await Promise.all([ensureDocumentCategories(), syncExpiredDocuments()])
  await ensureDemoDocument(actor.id)

  const [categories, documents] = await Promise.all([
    prisma.documentCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.document.findMany({
      include: {
        categoryRecord: true,
        uploader: { select: { fullName: true } },
      },
      orderBy: [{ uploadedAt: 'desc' }],
    }),
  ])

  return (
    <DashboardShell role={actor.role} title="Documents" nav={navForRole(actor.role)} hideRelatedLinks>
      <div className="p-4 md:p-6">
        <ManageDocumentsList
          addAction={<AddDocumentModal categories={categories} />}
          documents={documents.map((document) => ({
            id: document.id,
            title: document.title,
            status: document.status,
            categoryName: document.categoryRecord?.name || document.category || 'Uncategorized',
            uploaderName: document.uploader.fullName,
            uploadedAt: document.uploadedAt.toISOString(),
            isDemo: document.fileUrl.startsWith('demo://'),
            canView: Boolean(document.storagePath),
          }))}
        />
      </div>
    </DashboardShell>
  )
}
