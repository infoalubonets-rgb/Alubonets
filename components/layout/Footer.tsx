'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CONTACT_EMAIL, SITE_LOGO } from '@/lib/constants'

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
          <div className="col-span-1">
            <img src={SITE_LOGO} alt="Alubonets SHG Logo" className="h-16 w-auto object-contain mb-md" />
            <p className="footer-brand-name">Alubonets</p>
            <p className="text-on-primary/80 dark:text-on-primary-container/80 text-sm mt-md">
              Butere, Kakamega County, Kenya.
            </p>
          </div>

          <div className="col-span-1">
            <h4 className="font-label-bold text-label-bold text-on-primary dark:text-on-primary-container mb-md uppercase tracking-wide">
              Quick Links
            </h4>
            <nav className="flex flex-col gap-sm">
              <Link href="/" className={linkClass('/')}>
                Home
              </Link>
              <Link href="/about" className={linkClass('/about')}>
                About
              </Link>
              <Link href="/projects" className={linkClass('/projects')}>
                Projects
              </Link>
            </nav>
          </div>

          <div className="col-span-1">
            <h4 className="font-label-bold text-label-bold text-on-primary dark:text-on-primary-container mb-md uppercase tracking-wide">
              Explore
            </h4>
            <nav className="flex flex-col gap-sm">
              <Link href="/gallery" className={linkClass('/gallery')}>
                Gallery
              </Link>
              <Link href="/contact" className={linkClass('/contact')}>
                Contact
              </Link>
              <Link href="/admin" className={linkClass('/admin')}>
                Admin
              </Link>
            </nav>
          </div>

          <div className="col-span-1">
            <h4 className="font-label-bold text-label-bold text-on-primary dark:text-on-primary-container mb-md uppercase tracking-wide">
              Get in Touch
            </h4>
            <div className="flex flex-col gap-md">
              <div className="flex items-start gap-sm">
                <span className="material-symbols-outlined text-base flex-shrink-0 mt-xs">mail</span>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-on-primary/80 dark:text-on-primary-container/80 hover:text-secondary transition-colors duration-200"
                >
                  {CONTACT_EMAIL}
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
            <p className="text-on-primary/60 dark:text-on-primary-container/60">
              © 2026 Alubonets Self-Help Group. All rights reserved.
            </p>
            <div className="flex gap-lg text-on-primary/60 dark:text-on-primary-container/60">
              <a
                href="#"
                className="hover:text-on-primary dark:hover:text-on-primary-container transition-colors duration-200"
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="hover:text-on-primary dark:hover:text-on-primary-container transition-colors duration-200"
              >
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
