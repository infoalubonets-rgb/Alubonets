import { Suspense } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import MottoSection from '@/components/layout/MottoSection'
import AuthModal from '@/components/auth/AuthModal'
import SiteScripts from '@/components/layout/SiteScripts'
import PublicChatWidget from '@/components/layout/PublicChatWidget'
import { getPublicContact } from '@/lib/settings'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const contact = await getPublicContact()

  return (
    <>
      <Navbar />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <MottoSection />
      <Footer contactEmail={contact.email} contactPhone={contact.phone} />
      <Suspense fallback={null}>
        <AuthModal />
      </Suspense>
      <SiteScripts />
      <PublicChatWidget />
    </>
  )
}
