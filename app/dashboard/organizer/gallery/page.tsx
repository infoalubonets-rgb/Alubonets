import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { ORGANIZER_NAV } from '@/lib/dashboard/nav'
import { getSessionProfile } from '@/lib/auth/session'
import { actionCreateGallery } from '@/app/actions/domain'

export default async function OrganizerGalleryPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login')

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: gallery } = await supabase
    .from('gallery_photos')
    .select('id, url, caption, category, isPublic')
    .order('uploadedAt', { ascending: false })
    .limit(40)

  const photos = gallery ?? []

  return (
    <DashboardShell role="ORGANIZER" title="Gallery" nav={ORGANIZER_NAV}>
      <div className="space-y-5 p-4 md:p-6 max-w-4xl mx-auto">

        {/* Upload form */}
        <section className="rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
              <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>add_photo_alternate</span>
            </div>
            <h2 className="font-semibold text-[14px] text-on-surface dark:text-blue-50">Add gallery photo</h2>
          </div>
          <form action={actionCreateGallery} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
                Image URL <span className="text-secondary">*</span>
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 15 }}>link</span>
                <input name="url" placeholder="https://..." required className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">Caption</label>
              <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <input name="caption" placeholder="Short caption" className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">Category</label>
              <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <input name="category" placeholder="e.g. Events" className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30" />
              </div>
            </div>
            <label className="sm:col-span-2 flex items-center gap-2.5 text-[13px] text-on-surface dark:text-blue-200 cursor-pointer">
              <input type="checkbox" name="publish" className="h-4 w-4 rounded border-outline-variant accent-primary" />
              Publish immediately
            </label>
            <button type="submit" className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary py-2.5 text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span>
              Save photo
            </button>
          </form>
        </section>

        {/* Photo grid */}
        {photos.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant dark:text-blue-200/50">No photos yet.</p>
        ) : (
          <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {photos.map((g) => (
              <figure key={g.id} className="rounded-2xl overflow-hidden border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.url} alt={g.caption || 'Gallery photo'} className="h-40 w-full object-cover" />
                <figcaption className="flex items-center justify-between px-3 py-2 gap-2">
                  <span className="text-[12px] text-on-surface dark:text-blue-200 truncate">{g.caption || 'Untitled'}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${g.isPublic ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-surface-container dark:bg-[#1a2d4f] text-on-surface-variant dark:text-blue-200/50'}`}>
                    {g.isPublic ? 'Public' : 'Pending'}
                  </span>
                </figcaption>
              </figure>
            ))}
          </section>
        )}
      </div>
    </DashboardShell>
  )
}
