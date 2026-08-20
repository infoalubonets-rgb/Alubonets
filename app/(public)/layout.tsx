import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import MottoSection from '@/components/layout/MottoSection'
import AuthModal from '@/components/auth/AuthModal'
import SiteScripts from '@/components/layout/SiteScripts'
import PublicChatWidget from '@/components/layout/PublicChatWidget'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <MottoSection />
      <Footer />
      <AuthModal />
      <SiteScripts />
      <PublicChatWidget />
    </>
  )
}
