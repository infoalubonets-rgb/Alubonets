import type { Metadata } from 'next'
import ValuesCarousel from '@/components/about/ValuesCarousel'
import { COMMITTEE_HEADSHOT, HERO_IMAGE } from '@/lib/constants'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'About',
}

export const revalidate = 3600

const VALUES_TAGS = [
  'Unity',
  'Mutual Support',
  'Inclusivity',
  'Accountability',
  'Empowerment',
  'Respect',
]

const COMMITTEE = [
  { name: 'James M.', role: 'Chairperson', alt: 'Chairperson' },
  { name: 'Sarah K.', role: 'Secretary', alt: 'Secretary' },
  { name: 'David O.', role: 'Treasurer', alt: 'Treasurer' },
  { name: 'Mary N.', role: 'Vice Chair', alt: 'Vice Chair' },
  { name: 'Peter W.', role: 'Member Rep', alt: 'Member' },
]

type CommitteeCard = {
  name: string
  role: string
  alt: string
  photoUrl: string | null
  details: string[]
}

async function memberPhotoUrl(path: string | null) {
  if (!path) return null
  if (path.startsWith('http')) return path
  try {
    const signed = await createServerClient().storage.from('member-avatars').createSignedUrl(path, 60 * 60 * 24)
    return signed.data?.signedUrl ?? null
  } catch {
    return null
  }
}

async function loadCommittee(): Promise<CommitteeCard[]> {
  // Executives only appear once an Admin switches "Show on About page" on in Members.
  const executives = await prisma.user.findMany({
    where: { status: 'ACTIVE', showOnAbout: true, OR: [{ role: 'EXECUTIVE' }, { dashboardAccess: { has: 'EXECUTIVE' } }] },
    orderBy: [{ aboutOrder: 'asc' }, { fullName: 'asc' }],
    select: {
      id: true,
      fullName: true,
      aboutTitle: true,
      avatarUrl: true,
      email: true,
      phone: true,
      location: true,
      publicProfileFields: true,
      memberProfile: { select: { profession: true } },
    },
  })
  if (!executives.length) {
    return COMMITTEE.map((member) => ({ ...member, photoUrl: null, details: [] }))
  }
  return Promise.all(
    executives.map(async (user) => {
      const allowed = new Set(user.publicProfileFields)
      const role = user.aboutTitle || 'Executive Committee'
      return {
        name: user.fullName,
        role,
        alt: `${user.fullName}, ${role}`,
        photoUrl: allowed.has('photo') ? await memberPhotoUrl(user.avatarUrl) : null,
        details: [
          allowed.has('profession') ? user.memberProfile?.profession : null,
          allowed.has('location') ? user.location : null,
          allowed.has('email') ? user.email : null,
          allowed.has('phone') ? user.phone : null,
        ].filter((value): value is string => Boolean(value)),
      }
    }),
  )
}

export default async function AboutPage() {
  const committee = await loadCommittee()
  return (
    <main className="flex-grow">
      <section className="relative overflow-hidden px-md py-xl sm:py-xxl md:px-lg">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, #f9f9f7 0%, #f4f4f2 45%, rgba(217, 226, 255, 0.35) 100%)',
          }}
        />
        <div
          className="absolute -right-24 top-10 w-72 h-72 rounded-full pointer-events-none opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(254,128,21,0.18) 0%, transparent 70%)',
          }}
        />
        <div className="max-w-container-max mx-auto relative">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-xl items-center">
            <div className="reveal-left md:col-span-5 relative story-reveal">
              <div className="absolute -inset-3 rounded-2xl bg-primary/5 -rotate-2 pointer-events-none" />
              <div className="relative group rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,31,80,0.12)]">
                <img
                  alt="Community gathering"
                  className="h-[min(420px,55vh)] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 sm:h-[420px]"
                  src={HERO_IMAGE}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/50 via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-0 left-0 right-0 p-lg flex items-end justify-between gap-md">
                  <p className="font-label-bold text-label-bold text-white/95">Together since day one</p>
                  <div className="story-year-badge shrink-0 bg-secondary-container text-on-primary font-h3 text-h3 px-md py-sm rounded-lg shadow-lg">
                    2012
                  </div>
                </div>
              </div>
            </div>
            <div className="reveal-right md:col-span-7 space-y-lg">
              <div className="story-reveal story-reveal-delay-1">
                <h2 className="font-h2 text-h2-mobile md:text-h2 text-primary mb-md">Our Story</h2>
                <div className="h-1 w-16 bg-secondary-container rounded-full story-accent-line mb-md" />
                <p className="font-body-lg text-body-lg text-on-surface-variant">
                  Alubonets Self-Help Group was founded in 2012. The idea for the group arose during a pivotal moment of family need that brought several family members together to offer their collective support.
                </p>
                <p className="font-body-md text-body-md text-on-surface-variant mt-md">
                  This gathering highlighted that many relatives did not know one another or where other family members lived. That moment inspired a lasting group where members could meet regularly, support one another, and strengthen family relationships.
                </p>
              </div>
              <div className="story-reveal story-reveal-delay-2 relative pl-lg border-l-4 border-secondary-container bg-surface-container-lowest/80 rounded-r-xl py-lg pr-lg shadow-[0_8px_30px_rgba(0,31,80,0.06)]">
                <span
                  className="material-symbols-outlined text-secondary-container absolute -left-[18px] top-lg bg-surface rounded-full p-xs text-[22px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  diversity_3
                </span>
                <h3 className="font-h3 text-h3 text-primary mb-sm">The Meaning Behind Our Name</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  The name <span className="font-semibold text-primary">Alubonets</span> is a proud tribute to the descendants of the late Alubokho. It is a living symbol of our shared identity, heritage, and the family lineage that connects every branch of the wider Alubokho family across generations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-container-max px-md py-xl sm:py-xxl md:px-lg">
        <div className="reveal mx-auto mb-xl max-w-2xl text-center">
          <h2 className="mb-sm font-h2 text-h2-mobile text-primary md:text-h2">Mission, Vision &amp; Values</h2>
        </div>
        <div className="mb-xl grid grid-cols-1 gap-lg md:grid-cols-2">
          <div className="reveal rounded-2xl border border-primary/10 border-t-4 border-t-primary bg-surface-container-lowest p-lg">
            <p className="font-label-bold text-label-bold text-primary uppercase tracking-[0.12em] text-[11px] mb-sm">
              Mission
            </p>
            <p className="font-body-md text-body-md text-on-surface-variant">
              To unite members of the Alubokho family, strengthen family relationships, provide mutual welfare support, and empower members through education, health, economic opportunities, and transparent governance.
            </p>
          </div>
          <div className="reveal rounded-2xl border border-primary/10 border-t-4 border-t-secondary-container bg-surface-container-lowest p-lg" style={{ ['--reveal-delay' as string]: '120ms' }}>
            <p className="font-label-bold text-label-bold text-primary uppercase tracking-[0.12em] text-[11px] mb-sm">
              Vision
            </p>
            <p className="font-body-md text-body-md text-on-surface-variant">
              To build a united, inclusive, and empowered family that preserves its shared heritage, supports its members, embraces digital transformation, and contributes positively to the wider community.
            </p>
          </div>
        </div>
        <div className="reveal">
          <p className="font-label-bold text-label-bold text-primary uppercase tracking-[0.12em] text-[11px] mb-md text-center">
            Core Values
          </p>
          <div className="flex flex-wrap justify-center gap-sm">
            {VALUES_TAGS.map(tag => (
              <span
                key={tag}
                className="px-md py-sm rounded-full bg-primary-fixed text-primary font-label-bold text-label-bold text-[13px]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-primary px-md py-xl sm:py-xxl md:px-lg">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1.5px)',
            backgroundSize: '28px 28px',
            backgroundPosition: '14px 14px',
          }}
        />
        <div className="max-w-container-max mx-auto relative">
          <div className="reveal text-center mb-xl max-w-2xl mx-auto">
            <p className="font-label-bold text-label-bold text-secondary-container uppercase tracking-[0.14em] mb-sm">
              What guides Us
            </p>
          </div>
          <div className="reveal-scale">
            <ValuesCarousel />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-container-max px-md py-lg md:px-lg md:py-xl">
        <div className="reveal mx-auto mb-lg max-w-2xl text-center">
          <h2 className="mb-sm font-h2 text-h2-mobile text-primary md:text-h2">Executive Committee</h2>
          <p className="font-body-md text-[15px] leading-relaxed text-on-surface">
            The Alubonets Self-Help Group is guided by an executive committee that provides leadership, coordination, and oversight. Official names, ranks, and photographs will be added once leadership confirms them.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-md md:gap-lg">
          {committee.map((member, index) => {
            const rich = member.details.length > 0
            return (
              <div
                key={`${member.name}-${member.role}`}
                className={`reveal flex flex-col items-center ${rich ? 'w-56' : 'w-36'}`}
                style={{ ['--reveal-delay' as string]: `${index * 70}ms` }}
              >
                <img
                  alt={member.alt}
                  className="mb-sm h-28 w-28 rounded-full border border-primary/15 object-cover"
                  src={member.photoUrl || COMMITTEE_HEADSHOT}
                />
                <h4 className="text-center font-label-bold text-[15px] text-primary">{member.name}</h4>
                <span className="mt-xs text-center font-body-md text-[13px] text-primary/70">
                  {member.role}
                </span>
                {member.details.map((detail) => (
                  <p key={detail} className="mt-xs break-all text-center text-[12px] text-on-surface-variant">{detail}</p>
                ))}
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
