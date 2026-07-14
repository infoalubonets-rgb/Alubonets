import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MottoSection from '@/components/MottoSection'
import ValuesCarousel from '@/components/ValuesCarousel'

export const metadata: Metadata = {
  title: 'About',
}

const STORY_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCZgdHyKmCGz_o5KBJdu72GMMYkqxSWbeacN93sW4OWqsVfN-VugIhVA-DOXqT5al9xv9Etd-ihdRePfHEVWqz5DIw2XCTMdJ2nKwMj5ICkYoFcuMSeKxVq3Zrq4c5Kd1tSXgEC_fOROvHDW5ZC-Ox6fRIi28TYA05fqO7RagIVRgfP52QFokujjOAaYh0rSP8NkX2qc1Hov4lu07GLI3ruEJnZEVlCcy1lblMrSu4hQg4zOgVKcbdzMg'

const HEADSHOT =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCP2vv9U7rF3U2135dOaU7NfE63R21qtCWecXW1hdYdfmQOa8bv88igMnVGVaYCnHVg91GTIUuHdE8T7zeRedoz0VTRyr8_Ib5JgYUl50haQeY_-mPeh9XoE-MbRGfoP-Dtdh0xarETml_jegJBNzTW7oW9tGOfUTb0ar0sMUTNzznkKqsAW9aKuYKy56hM0u5H6Bhxl0v51Q7awrAE61208Youd1avi9PbESSa0DK4vpyAvpto7V17Tw'

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

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="flex-grow">
        {/* Our Story */}
        <section className="relative py-xxl px-lg overflow-hidden">
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
              <div className="md:col-span-5 relative story-reveal">
                <div className="absolute -inset-3 rounded-2xl bg-primary/5 -rotate-2 pointer-events-none" />
                <div className="relative group rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,31,80,0.12)]">
                  <img
                    alt="Community gathering"
                    className="w-full h-[420px] object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    src={STORY_IMG}
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
              <div className="md:col-span-7 space-y-lg">
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

        {/* Mission, Vision & Values */}
        <section className="py-xxl px-lg max-w-container-max mx-auto">
          <div className="text-center mb-xl max-w-2xl mx-auto">
            <h2 className="font-h2 text-h2-mobile md:text-h2 text-primary mb-sm">Mission, Vision &amp; Values</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg mb-xl">
            <div className="bg-surface-container-lowest rounded-2xl p-lg border border-primary/10 border-t-4 border-t-primary">
              <p className="font-label-bold text-label-bold text-primary uppercase tracking-[0.12em] text-[11px] mb-sm">
                Mission
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant">
                To unite members of the Alubokho family, strengthen family relationships, provide mutual welfare support, and empower members through education, health, economic opportunities, and transparent governance.
              </p>
            </div>
            <div className="bg-surface-container-lowest rounded-2xl p-lg border border-primary/10 border-t-4 border-t-secondary-container">
              <p className="font-label-bold text-label-bold text-primary uppercase tracking-[0.12em] text-[11px] mb-sm">
                Vision
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant">
                To build a united, inclusive, and empowered family that preserves its shared heritage, supports its members, embraces digital transformation, and contributes positively to the wider community.
              </p>
            </div>
          </div>
          <div>
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

        {/* How we work */}
        <section className="relative py-xxl px-lg overflow-hidden bg-primary">
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
            <div className="text-center mb-xl max-w-2xl mx-auto story-reveal">
              <p className="font-label-bold text-label-bold text-secondary-container uppercase tracking-[0.14em] mb-sm">
                What guides Us
              </p>
            </div>
            <ValuesCarousel />
          </div>
        </section>

        {/* Executive Committee */}
        <section className="py-lg md:py-xl px-lg max-w-container-max mx-auto">
          <div className="text-center mb-lg max-w-2xl mx-auto">
            <h2 className="font-h2 text-h2-mobile md:text-h2 text-primary mb-sm">Executive Committee</h2>
            <p className="font-body-md text-[15px] leading-relaxed text-on-surface">
              The Alubonets Self-Help Group is guided by an executive committee that provides leadership, coordination, and oversight. Official names, ranks, and photographs will be added once leadership confirms them.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-md md:gap-lg">
            {COMMITTEE.map(member => (
              <div key={member.name} className="flex flex-col items-center w-36">
                <img
                  alt={member.alt}
                  className="w-28 h-28 rounded-full object-cover border border-primary/15 mb-sm"
                  src={HEADSHOT}
                />
                <h4 className="font-label-bold text-[15px] text-primary text-center">{member.name}</h4>
                <span className="font-body-md text-[13px] text-primary/70 text-center mt-xs">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <MottoSection />
      <Footer />
    </>
  )
}
