import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MottoSection from '@/components/MottoSection'

export const metadata: Metadata = {
  title: 'Projects',
}

export default function ProjectsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-grow w-full max-w-container-max mx-auto px-md md:px-lg py-lg md:py-xl">
        {/* Tabs */}
        <div className="flex flex-wrap gap-sm justify-center mb-xl">
          <button className="px-md py-sm rounded-full bg-secondary-container text-on-primary font-label-bold text-label-bold min-h-[48px]">
            All
          </button>
          <button className="px-md py-sm rounded-full bg-surface-container text-on-surface-variant font-label-bold text-label-bold min-h-[48px] border border-outline-variant hover:bg-surface-variant transition-colors">
            Ongoing
          </button>
          <button className="px-md py-sm rounded-full bg-surface-container text-on-surface-variant font-label-bold text-label-bold min-h-[48px] border border-outline-variant hover:bg-surface-variant transition-colors">
            Completed
          </button>
          <button className="px-md py-sm rounded-full bg-surface-container text-on-surface-variant font-label-bold text-label-bold min-h-[48px] border border-outline-variant hover:bg-surface-variant transition-colors">
            Upcoming
          </button>
        </div>

        {/* Empty state */}
        <div className="mb-xxl flex flex-col items-center justify-center text-center py-[80px] gap-md">
          <span className="material-symbols-outlined text-[72px] text-primary/15">assignment</span>
          <h3 className="font-h3 text-h3 text-on-surface">No Projects Yet</h3>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
            Welfare, education, and community initiatives will appear here once they are shared by the group.
          </p>
        </div>
      </main>

      <MottoSection />
      <Footer />
    </>
  )
}
