import type { Metadata } from 'next'
import Link from 'next/link'
import HeroActions from '@/components/home/HeroActions'
import { HERO_IMAGE } from '@/lib/constants'

export const metadata: Metadata = {
  title: {
    absolute: 'Alubonets SHG - Home',
  },
}

export default function HomePage() {
  return (
    <main className="flex-grow">
      <section className="bg-primary text-on-primary py-xxl px-md md:px-lg relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url("${HERO_IMAGE}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div className="max-w-container-max mx-auto flex flex-col md:flex-row items-center gap-xl relative z-10">
          <div className="w-full md:w-1/2 flex flex-col gap-lg">
            <h1 className="font-h1-mobile text-h1-mobile md:font-h1 md:text-h1 text-on-primary">
              One Family, One Vision, Endless Possibilities.
            </h1>
            <p className="font-body-lg text-body-lg text-on-primary/90 max-w-lg">
              Alubonets Self-Help Group brings together the descendants of the Alubokho family to strengthen unity, provide welfare support and create opportunities for social and economic development.
            </p>
            <HeroActions />
          </div>
          <div className="w-full md:w-1/2 rounded-xl overflow-hidden shadow-sm">
            <img
              className="w-full h-auto object-cover aspect-video md:aspect-[4/3] rounded-xl border border-outline-variant/20"
              src={HERO_IMAGE}
              alt="A vibrant community self-help group meeting"
            />
          </div>
        </div>
      </section>

      <section className="py-xxl px-md md:px-lg bg-surface-container-low">
        <div className="max-w-container-max mx-auto">
          <div className="text-center mb-lg max-w-2xl mx-auto">
            <p className="font-label-bold text-label-bold text-secondary-container uppercase tracking-[0.14em] mb-xs">
              Who we are
            </p>
            <h2 className="font-h2 text-h2-mobile md:text-h2 text-primary">Mission, Vision &amp; Values</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <article className="mvv-card mvv-card-navy bg-white p-md md:p-lg rounded-2xl border border-primary/10 flex flex-col text-left group">
              <h3 className="mvv-title font-h3 text-[20px] leading-snug text-primary mb-sm">Mission</h3>
              <span className="mvv-rule block w-8 h-0.5 bg-primary mb-md" aria-hidden="true" />
              <p className="mvv-body font-body-md text-[15px] leading-relaxed text-on-surface">
                To unite members of the Alubokho family, strengthen family relationships, provide mutual welfare support, and empower members through education, health, economic opportunities, and transparent governance.
              </p>
            </article>
            <article className="mvv-card mvv-card-orange bg-primary p-md md:p-lg rounded-2xl border border-transparent flex flex-col text-left group">
              <h3 className="mvv-title font-h3 text-[20px] leading-snug text-on-primary mb-sm">Vision</h3>
              <span className="mvv-rule block w-8 h-0.5 bg-secondary-container mb-md" aria-hidden="true" />
              <p className="mvv-body font-body-md text-[15px] leading-relaxed text-on-primary/90">
                To build a united, inclusive, and empowered family that preserves its shared heritage, supports its members, embraces digital transformation, and contributes positively to the wider community.
              </p>
            </article>
            <article className="mvv-card mvv-card-navy bg-white p-md md:p-lg rounded-2xl border border-primary/10 flex flex-col text-left group">
              <h3 className="mvv-title font-h3 text-[20px] leading-snug text-primary mb-sm">Values</h3>
              <span className="mvv-rule block w-8 h-0.5 bg-primary mb-md" aria-hidden="true" />
              <p className="mvv-body font-body-md text-[15px] leading-relaxed text-on-surface">
                Unity, Mutual Support, Inclusivity, Accountability, Empowerment, and Respect.
              </p>
            </article>
          </div>
          <p className="text-center mt-lg font-body-md text-[15px] text-on-surface-variant">
            Want the full story behind the group?{' '}
            <Link href="/about" className="text-secondary-container font-semibold hover:underline">
              Read about us
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
