import DashboardShell from '@/components/dashboard/DashboardShell'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { actionApproveGallery } from '@/app/actions/domain'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/session'

export default async function AdminGalleryQueuePage() {
  await requireAdmin()
  const queue = await prisma.galleryPhoto.findMany({
    where: { isPublic: false },
    orderBy: { uploadedAt: 'desc' },
    include: { uploader: { select: { fullName: true, email: true } } },
  })

  return (
    <DashboardShell role="ADMIN" title="Gallery queue" nav={ADMIN_NAV}>
      <div className="space-y-4 p-4 md:p-6">
        <p className="text-sm text-on-surface-variant">
          Approve photos to publish them on the public gallery.
        </p>
        {queue.length === 0 && (
          <p className="text-sm text-on-surface-variant rounded-xl border p-4 bg-surface">
            No pending photos.
          </p>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {queue.map((g) => (
            <figure key={g.id} className="border rounded-xl overflow-hidden bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.url} alt={g.caption || 'Pending'} className="h-40 w-full object-cover" />
              <figcaption className="p-3 space-y-2">
                <p className="text-sm font-medium">{g.caption || 'Untitled'}</p>
                <p className="text-xs text-on-surface-variant">
                  {g.uploader?.fullName || 'Unknown'} · {g.uploadedAt.toLocaleDateString()}
                </p>
                <form action={actionApproveGallery}>
                  <input type="hidden" name="id" value={g.id} />
                  <input type="hidden" name="approve" value="true" />
                  <button className="w-full px-3 py-1.5 rounded-lg bg-secondary-container text-sm">
                    Publish
                  </button>
                </form>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </DashboardShell>
  )
}
