import type { Metadata } from 'next'
import { getPublicGallery } from '@/lib/data/queries'
import GalleryClient from '@/components/public/GalleryClient'
import MemberGate from '@/components/public/MemberGate'
import { getMemberAccess } from '@/lib/auth/member-access'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Gallery',
  description:
    'Photos from Alubonets Self-Help Group gatherings, events and projects, celebrating the Alubokho family and our community in Butere, Kenya.',
  path: '/gallery',
})
export const dynamic = 'force-dynamic'

export default async function GalleryPage() {
  const access = await getMemberAccess()
  if (access.state === 'anonymous') {
    return (
      <main className="flex-grow">
        <div className="max-w-container-max mx-auto px-md py-xl md:px-lg">
          <MemberGate variant="login" what="The gallery" returnTo="/gallery" />
        </div>
      </main>
    )
  }
  const photos = await getPublicGallery()
  return (
    <main className="flex-grow">
      <GalleryClient photos={photos} />
    </main>
  )
}
