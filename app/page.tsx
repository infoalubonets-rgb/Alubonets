import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MottoSection from '@/components/MottoSection'

export const metadata: Metadata = {
  title: 'Alubonets SHG - Home',
}

const HERO_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCZgdHyKmCGz_o5KBJdu72GMMYkqxSWbeacN93sW4OWqsVfN-VugIhVA-DOXqT5al9xv9Etd-ihdRePfHEVWqz5DIw2XCTMdJ2nKwMj5ICkYoFcuMSeKxVq3Zrq4c5Kd1tSXgEC_fOROvHDW5ZC-Ox6fRIi28TYA05fqO7RagIVRgfP52QFokujjOAaYh0rSP8NkX2qc1Hov4lu07GLI3ruEJnZEVlCcy1lblMrSu4hQg4zOgVKcbdzMg'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="bg-primary text-on-primary py-xxl px-md md:px-lg relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `url("${HERO_IMG}")`,
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
              <div className="flex flex-col sm:flex-row gap-md mt-sm">
                <Link
                  href="/contact"
                  className="bg-secondary-container text-on-primary font-label-bold text-label-bold px-lg py-sm rounded-lg min-h-[48px] hover:bg-secondary transition-colors w-full sm:w-auto text-center flex items-center justify-center"
                >
                  Join the Group
                </Link>
                <Link
                  href="/about"
                  className="border-2 border-on-primary text-on-primary font-label-bold text-label-bold px-lg py-sm rounded-lg min-h-[48px] hover:bg-on-primary/10 transition-colors w-full sm:w-auto text-center flex items-center justify-center"
                >
                  Learn More
                </Link>
              </div>
            </div>
            <div className="w-full md:w-1/2 rounded-xl overflow-hidden shadow-sm">
              <img
                className="w-full h-auto object-cover aspect-video md:aspect-[4/3] rounded-xl border border-outline-variant/20"
                src={HERO_IMG}
                alt="A vibrant community self-help group meeting"
              />
            </div>
          </div>
        </section>

        {/* Mission Strip */}
        <section className="py-xxl px-md md:px-lg bg-surface-container-low">
          <div className="max-w-container-max mx-auto">
            <div className="text-center mb-lg max-w-2xl mx-auto">
              <p className="font-label-bold text-label-bold text-secondary-container uppercase tracking-[0.14em] mb-xs">Who we are</p>
              <h2 className="font-h2 text-h2-mobile md:text-h2 text-primary">Mission, Vision &amp; Values</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
              {/* Mission */}
              <article className="mvv-card mvv-card-navy bg-white p-md md:p-lg rounded-2xl border border-primary/10 flex flex-col text-left group">
                <h3 className="mvv-title font-h3 text-[20px] leading-snug text-primary mb-sm">Mission</h3>
                <span className="mvv-rule block w-8 h-0.5 bg-primary mb-md" aria-hidden="true" />
                <p className="mvv-body font-body-md text-[15px] leading-relaxed text-on-surface">
                  To unite members of the Alubokho family, strengthen family relationships, provide mutual welfare support, and empower members through education, health, economic opportunities, and transparent governance.
                </p>
              </article>
              {/* Vision */}
              <article className="mvv-card mvv-card-orange bg-primary p-md md:p-lg rounded-2xl border border-transparent flex flex-col text-left group">
                <h3 className="mvv-title font-h3 text-[20px] leading-snug text-on-primary mb-sm">Vision</h3>
                <span className="mvv-rule block w-8 h-0.5 bg-secondary-container mb-md" aria-hidden="true" />
                <p className="mvv-body font-body-md text-[15px] leading-relaxed text-on-primary/90">
                  To build a united, inclusive, and empowered family that preserves its shared heritage, supports its members, embraces digital transformation, and contributes positively to the wider community.
                </p>
              </article>
              {/* Values */}
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
              <Link href="/about" className="text-secondary-container font-semibold hover:underline">Read about us</Link>.
            </p>
          </div>
        </section>
      </main>

      <MottoSection />
      <Footer />
    </>
  )
}
