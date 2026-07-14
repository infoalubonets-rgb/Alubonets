'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LOGO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCnSzS3JcCrGOIYnlA_odPQfW_EPHR1u48LU3KS766KoVD3igIme0EQq0vqNQG3PooaTM2bQqbTmk0RImwZPTDU2sdNN8x8Ewm1oKnJaxZir_KAlNdgRMYz9EyDkfErXWWvZg0JTfdI-WD5J0fK-SLORJPmc2el4H64y1qLg_W15yfg59vO479BZ_O3blOrXFo_F3Ht3cNs44g0jJDLYDrGYmavEdni6HS_DFgt8SvyLJk8W-BIPKiPF2oGxWdN9ncMpZo'

export default function Footer() {
  const pathname = usePathname()

  const linkClass = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href))
      ? 'text-secondary-fixed font-bold hover:text-secondary transition-colors duration-200'
      : 'text-on-primary/80 dark:text-on-primary-container/80 hover:text-secondary transition-colors duration-200'

  return (
    <footer className="bg-primary dark:bg-primary-container text-on-primary dark:text-on-primary-container font-body-md text-body-md w-full mt-auto site-footer">
      <div className="max-w-container-max mx-auto px-md md:px-lg py-lg md:py-xxl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg mb-xl">
          {/* Brand */}
          <div className="col-span-1">
            <img src={LOGO_URL} alt="Alubonets SHG Logo" className="h-16 w-auto object-contain mb-md" />
            <p className="footer-brand-name">Alubonets</p>
            <p className="text-on-primary/80 dark:text-on-primary-container/80 text-sm mt-md">Butere, Kakamega County, Kenya.</p>
          </div>

          {/* Quick Links */}
          <div className="col-span-1">
            <h4 className="font-label-bold text-label-bold text-on-primary dark:text-on-primary-container mb-md uppercase tracking-wide">Quick Links</h4>
            <nav className="flex flex-col gap-sm">
              <Link href="/" className={linkClass('/')}>Home</Link>
              <Link href="/about" className={linkClass('/about')}>About</Link>
              <Link href="/projects" className={linkClass('/projects')}>Projects</Link>
            </nav>
          </div>

          {/* Explore */}
          <div className="col-span-1">
            <h4 className="font-label-bold text-label-bold text-on-primary dark:text-on-primary-container mb-md uppercase tracking-wide">Explore</h4>
            <nav className="flex flex-col gap-sm">
              <Link href="/gallery" className={linkClass('/gallery')}>Gallery</Link>
              <Link href="/contact" className={linkClass('/contact')}>Contact</Link>
              <Link href="/admin" className={linkClass('/admin')}>Admin</Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="col-span-1">
            <h4 className="font-label-bold text-label-bold text-on-primary dark:text-on-primary-container mb-md uppercase tracking-wide">Get in Touch</h4>
            <div className="flex flex-col gap-md">
              <div className="flex items-start gap-sm">
                <span className="material-symbols-outlined text-base flex-shrink-0 mt-xs">mail</span>
                <a href="mailto:info@alubonets.com" className="text-on-primary/80 dark:text-on-primary-container/80 hover:text-secondary transition-colors duration-200">
                  info@alubonets.com
                </a>
              </div>
              <div className="flex items-start gap-sm">
                <span className="material-symbols-outlined text-base flex-shrink-0 mt-xs">call</span>
                <span className="text-on-primary/80 dark:text-on-primary-container/80">Coming soon</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-md text-sm">
            <p className="text-on-primary/60 dark:text-on-primary-container/60">© 2026 Alubonets Self-Help Group. All rights reserved.</p>
            <div className="flex gap-lg text-on-primary/60 dark:text-on-primary-container/60">
              <a href="#" className="hover:text-on-primary dark:hover:text-on-primary-container transition-colors duration-200">Privacy Policy</a>
              <a href="#" className="hover:text-on-primary dark:hover:text-on-primary-container transition-colors duration-200">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
