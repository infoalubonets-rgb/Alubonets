import DashboardShell from '@/components/dashboard/DashboardShell'
import { ADMIN_NAV } from '@/lib/dashboard/nav'
import { actionApproveGallery } from '@/app/actions/domain'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { getOrganizerGalleryPhotos } from '@/lib/data/queries'
import AddGalleryPhotoButton from '@/components/dashboard/AddGalleryPhotoButton'
import OrganizerGalleryClient from '@/components/dashboard/OrganizerGalleryClient'

export default async function AdminGalleryPage() {
  await requireAdmin()
  const [queue, photos] = await Promise.all([
    prisma.galleryPhoto.findMany({
      where: { isPublic: false },
      orderBy: { uploadedAt: 'desc' },
      include: { uploader: { select: { fullName: true, email: true } } },
    }),
    getOrganizerGalleryPhotos(),
  ])

  return (
    <DashboardShell role="ADMIN" title="Gallery" nav={ADMIN_NAV} pageAction={<AddGalleryPhotoButton />}>
      {queue.length > 0 && (
      <div className="space-y-4 p-4 pb-0 md:p-6 md:pb-0">
        <p className="text-sm text-on-surface-variant">
          {queue.length} photo{queue.length !== 1 ? 's' : ''} waiting — publish them to show on the public gallery.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {queue.map((g) => (
            <figure key={g.id} className="border rounded-xl overflow-hidden bg-surface">
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
      )}
      <OrganizerGalleryClient photos={photos} showAddButton={false} />
    </DashboardShell>
  )
}
