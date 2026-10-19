import type { Metadata } from 'next'
import Link from 'next/link'
import HeroActions from '@/components/home/HeroActions'
import { HERO_IMAGE } from '@/lib/constants'
import { getPublicContent } from '@/lib/public-content'
import { SITE_DESCRIPTION } from '@/lib/seo'

export const metadata: Metadata = {
  title: {
    absolute: 'Alubonets SHG - Alubokho Family Self-Help Group, Butere, Kenya',
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
}

export default async function HomePage() {
  const content = await getPublicContent('HOME')
  return (
    <main className="flex-grow">
      <section className="relative overflow-hidden bg-primary px-md py-xl text-on-primary sm:py-xxl md:px-lg">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("${HERO_IMAGE}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div className="relative z-10 mx-auto flex max-w-container-max flex-col items-stretch gap-lg md:flex-row md:items-center md:gap-xl">
          <div className="reveal-left flex w-full min-w-0 flex-col gap-md sm:gap-lg md:w-1/2">
            <h1 className="font-h1-mobile text-h1-mobile text-on-primary md:font-h1 md:text-h1">
              {content.headline}
            </h1>
            <p className="max-w-lg font-body-lg text-[15px] leading-relaxed text-on-primary/90 sm:text-body-lg">
              {content.introduction}
            </p>
            <HeroActions />
          </div>
          <div className="reveal-right hidden w-full min-w-0 overflow-hidden rounded-xl shadow-sm md:block md:w-1/2">
            <img
              className="aspect-[4/3] h-auto w-full rounded-xl border border-outline-variant/20 object-cover"
              src={HERO_IMAGE}
              alt="A vibrant community self-help group meeting"
            />
          </div>
        </div>
      </section>

      <section className="bg-surface-container-low px-md py-xl sm:py-xxl md:px-lg">
        <div className="mx-auto max-w-container-max">
          <div className="reveal mx-auto mb-lg max-w-2xl text-center">
            <p className="mb-xs font-label-bold text-label-bold uppercase tracking-[0.14em] text-secondary-container">
              Who we are
            </p>
            <h2 className="font-h2 text-h2-mobile text-primary md:text-h2">Mission, Vision &amp; Values</h2>
          </div>
          <div className="grid grid-cols-1 gap-md md:grid-cols-3">
            <article
              className="reveal mvv-card mvv-card-navy group flex flex-col rounded-2xl border border-primary/10 bg-white p-md text-left md:p-lg"
              style={{ ['--reveal-delay' as string]: '60ms' }}
            >
              <h3 className="mvv-title mb-sm font-h3 text-[20px] leading-snug text-primary">Mission</h3>
              <span className="mvv-rule mb-md block h-0.5 w-8 bg-primary" aria-hidden="true" />
              <p className="mvv-body font-body-md text-[15px] leading-relaxed text-on-surface">
                {content.mission}
              </p>
            </article>
            <article
              className="reveal-scale mvv-card mvv-card-orange group flex flex-col rounded-2xl border border-transparent bg-primary p-md text-left md:p-lg"
              style={{ ['--reveal-delay' as string]: '140ms' }}
            >
              <h3 className="mvv-title mb-sm font-h3 text-[20px] leading-snug text-on-primary">Vision</h3>
              <span className="mvv-rule mb-md block h-0.5 w-8 bg-secondary-container" aria-hidden="true" />
              <p className="mvv-body font-body-md text-[15px] leading-relaxed text-on-primary/90">
                {content.vision}
              </p>
            </article>
            <article
              className="reveal mvv-card mvv-card-navy group flex flex-col rounded-2xl border border-primary/10 bg-white p-md text-left md:p-lg"
              style={{ ['--reveal-delay' as string]: '220ms' }}
            >
              <h3 className="mvv-title mb-sm font-h3 text-[20px] leading-snug text-primary">Values</h3>
              <span className="mvv-rule mb-md block h-0.5 w-8 bg-primary" aria-hidden="true" />
              <p className="mvv-body font-body-md text-[15px] leading-relaxed text-on-surface">
                Unity, Mutual Support, Inclusivity, Accountability, Empowerment, and Respect.
              </p>
            </article>
          </div>
          <p className="reveal mt-lg text-center font-body-md text-[15px] text-on-surface-variant">
            Want the full story behind the group?{' '}
            <Link href="/about" className="font-semibold text-secondary-container hover:underline">
              Read about us
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
