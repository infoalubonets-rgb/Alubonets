import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gallery',
}

export default function GalleryPage() {
  return (
    <main className="flex-grow">
      <section className="border-b border-outline-variant/30 bg-surface">
        <div className="max-w-container-max mx-auto px-md md:px-lg py-xl flex overflow-x-auto gap-sm md:gap-md hide-scrollbar">
          <button className="bg-secondary-container text-on-primary rounded-full px-lg py-sm font-label-bold text-label-bold whitespace-nowrap min-h-[40px] shadow-[0px_4px_12px_rgba(20,32,51,0.05)] border border-secondary-container transition-all">
            All
          </button>
          <button className="bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-high rounded-full px-lg py-sm font-body-md text-body-md whitespace-nowrap min-h-[40px] transition-all">
            Meetings
          </button>
          <button className="bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-high rounded-full px-lg py-sm font-body-md text-body-md whitespace-nowrap min-h-[40px] transition-all">
            Events
          </button>
          <button className="bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-high rounded-full px-lg py-sm font-body-md text-body-md whitespace-nowrap min-h-[40px] transition-all">
            Welfare Activities
          </button>
          <button className="bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-high rounded-full px-lg py-sm font-body-md text-body-md whitespace-nowrap min-h-[40px] transition-all">
            Projects
          </button>
        </div>
      </section>

      <section className="max-w-container-max mx-auto px-md md:px-lg py-lg md:py-xxl">
        <div className="flex flex-col items-center justify-center text-center py-[80px] gap-md">
          <span className="material-symbols-outlined text-[72px] text-primary/15">photo_library</span>
          <h3 className="font-h3 text-h3 text-on-surface">No Photos Added Yet</h3>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            Photos from meetings, events, and welfare activities will appear here once they are shared.
          </p>
        </div>
      </section>
    </main>
  )
}
