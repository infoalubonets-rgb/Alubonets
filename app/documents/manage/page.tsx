import DashboardShell from '@/components/dashboard/DashboardShell'
import { requireActiveRole } from '@/lib/auth/session'
import { navForRole } from '@/lib/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { ensureDocumentCategories } from '@/lib/document-categories'
import { syncExpiredDocuments } from '@/lib/documents'
import {
  createDocumentCategory,
  deleteRepositoryDocument,
  replaceRepositoryDocument,
  setDocumentStatus,
  uploadRepositoryDocument,
} from '@/app/actions/documents'

const ROLES = ['ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'] as const

export default async function ManageDocumentsPage() {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY'])
  await Promise.all([ensureDocumentCategories(), syncExpiredDocuments()])
  const [categories, documents, recentDownloads] = await Promise.all([
    prisma.documentCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.document.findMany({
      include: {
        categoryRecord: true,
        uploader: { select: { fullName: true } },
        downloads: { select: { id: true } },
      },
      orderBy: [{ uploadedAt: 'desc' }],
    }),
    prisma.documentDownload.findMany({
      take: 40,
      orderBy: { downloadedAt: 'desc' },
      include: {
        document: { select: { title: true, version: true } },
        user: { select: { fullName: true, email: true } },
      },
    }),
  ])

  return (
    <DashboardShell role={actor.role} title="Manage documents" nav={navForRole(actor.role)}>
      <div className="space-y-6 p-4 md:p-6">
        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-xl text-primary">Upload document</h2>
          <form action={uploadRepositoryDocument} className="mt-3 grid gap-2 md:grid-cols-3">
            <input name="title" required placeholder="Title" className="rounded-lg border px-3 py-2" />
            <select name="categoryId" required className="rounded-lg border px-3 py-2">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input name="file" type="file" required className="rounded-lg border px-3 py-2" />
            <textarea name="description" placeholder="Description" className="rounded-lg border px-3 py-2" />
            <select name="accessLevel" className="rounded-lg border px-3 py-2">
              <option value="MEMBERS">All approved members</option>
              <option value="SELECTED_ROLES">Selected roles</option>
              <option value="ADMIN_SECRETARY">Admin/Secretary only</option>
              <option value="PUBLIC">Public</option>
            </select>
            <select name="status" className="rounded-lg border px-3 py-2">
              <option>DRAFT</option>
              <option>PUBLISHED</option>
            </select>
            <input name="effectiveAt" type="date" className="rounded-lg border px-3 py-2" />
            <input name="expiresAt" type="date" className="rounded-lg border px-3 py-2" />
            <fieldset className="flex flex-wrap gap-2 text-xs">
              {ROLES.map((role) => (
                <label key={role}>
                  <input type="checkbox" name="allowedRoles" value={role} /> {role}
                </label>
              ))}
            </fieldset>
            <button className="w-fit rounded-full bg-primary px-4 py-2 text-on-primary">Upload</button>
          </form>
        </section>

        {actor.role === 'ADMIN' && (
          <section className="rounded-2xl border bg-surface p-5">
            <h2 className="font-h3 text-lg text-primary">Add category</h2>
            <form action={createDocumentCategory} className="mt-2 flex gap-2">
              <input name="name" required className="rounded-lg border px-3 py-2" />
              <button className="rounded-full bg-primary px-4 py-2 text-on-primary">Add</button>
            </form>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-h3 text-xl text-primary">Repository and version history</h2>
          {documents.map((document) => (
            <article key={document.id} className="rounded-2xl border bg-surface p-4">
              <b>
                {document.title} · v{document.version}.0 · {document.status}
              </b>
              <p className="text-sm">
                {document.categoryRecord?.name} · {document.downloads.length} downloads ·{' '}
                {document.uploader.fullName}
                {document.expiresAt ? ` · Expires ${document.expiresAt.toLocaleDateString()}` : ''}
              </p>
              <a
                href={`/api/documents/${document.id}/download`}
                className="mt-1 inline-block text-sm text-primary underline"
              >
                Download via signed URL
              </a>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <form action={replaceRepositoryDocument}>
                  <input type="hidden" name="id" value={document.id} />
                  <input name="file" type="file" required className="block w-full text-xs" />
                  <input
                    name="reason"
                    required
                    minLength={5}
                    placeholder="Replacement reason"
                    className="mt-1 rounded-lg border px-2 py-1"
                  />
                  <button className="ml-2 text-sm text-primary underline">New version</button>
                </form>
                <form action={setDocumentStatus}>
                  <input type="hidden" name="id" value={document.id} />
                  <select name="status" defaultValue={document.status} className="rounded-lg border px-2 py-1">
                    <option>DRAFT</option>
                    <option>PUBLISHED</option>
                    <option>ARCHIVED</option>
                    <option>EXPIRED</option>
                  </select>
                  <input
                    name="reason"
                    required
                    placeholder="Reason"
                    className="ml-1 rounded-lg border px-2 py-1"
                  />
                  <button className="ml-2 text-sm text-primary underline">Update</button>
                </form>
                {actor.role === 'ADMIN' && (
                  <form action={deleteRepositoryDocument}>
                    <input type="hidden" name="id" value={document.id} />
                    <input
                      name="reason"
                      required
                      minLength={5}
                      placeholder="Deletion reason"
                      className="rounded-lg border px-2 py-1"
                    />
                    <button className="ml-2 text-sm text-error underline">Delete</button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border bg-surface p-5">
          <h2 className="font-h3 text-xl text-primary">Download audit</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Recent repository downloads</p>
          <ul className="mt-3 divide-y">
            {recentDownloads.map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span>
                  <b>{row.document.title}</b> v{row.document.version} · {row.user.fullName}
                </span>
                <span className="text-on-surface-variant">
                  {row.downloadedAt.toLocaleString()}
                  {row.ipAddress ? ` · ${row.ipAddress}` : ''}
                </span>
              </li>
            ))}
            {!recentDownloads.length && <li className="py-2 text-sm">No downloads recorded yet.</li>}
          </ul>
        </section>
      </div>
    </DashboardShell>
  )
}
