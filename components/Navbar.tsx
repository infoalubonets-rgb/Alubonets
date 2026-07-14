'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { openAuthModal } from './AuthModal'

const LOGO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCnSzS3JcCrGOIYnlA_odPQfW_EPHR1u48LU3KS766KoVD3igIme0EQq0vqNQG3PooaTM2bQqbTmk0RImwZPTDU2sdNN8x8Ewm1oKnJaxZir_KAlNdgRMYz9EyDkfErXWWvZg0JTfdI-WD5J0fK-SLORJPmc2el4H64y1qLg_W15yfg59vO479BZ_O3blOrXFo_F3Ht3cNs44g0jJDLYDrGYmavEdni6HS_DFgt8SvyLJk8W-BIPKiPF2oGxWdN9ncMpZo'

const links = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/projects', label: 'Projects' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/contact', label: 'Contact' },
  { href: '/admin', label: 'Admin', small: true },
]

export default function Navbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <>
      <header className="bg-surface dark:bg-surface-dim sticky top-0 w-full border-b border-outline-variant z-50">
        <div className="flex justify-between items-center h-20 px-md md:px-lg max-w-container-max mx-auto">
          <Link href="/" className="flex items-center gap-sm">
            <img src={LOGO_URL} alt="Alubonets SHG Logo" className="h-16 w-auto object-cover" />
            <span className="font-h3 text-h3 text-primary">Alubonets</span>
          </Link>

          <nav className="hidden md:flex gap-lg h-full items-center">
            {links.map(({ href, label, small }) => (
              <Link
                key={href}
                href={href}
                className={`h-full flex items-center active:scale-95 transition-transform ${small ? 'text-xs' : ''} ${
                  isActive(href)
                    ? 'text-secondary-container font-semibold border-b-2 border-secondary-container pb-1'
                    : 'text-primary font-medium dark:text-on-surface-variant hover:text-secondary-container transition-colors duration-200'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-md">
            <button
              className="bg-secondary-container text-on-primary font-label-bold text-label-bold px-md py-sm rounded-lg min-h-[48px] hover:opacity-90 transition-opacity flex items-center justify-center hidden md:flex"
              onClick={openAuthModal}
            >
              Login / Register
            </button>
            <button
              className="md:hidden text-primary flex items-center justify-center p-sm"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-surface-container-lowest border-t border-outline-variant px-md py-lg flex flex-col gap-md z-40">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`py-unit transition-colors duration-200 ${
                isActive(href)
                  ? 'text-secondary font-bold'
                  : 'text-primary hover:text-secondary-container'
              }`}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
          <button
            className="bg-secondary-container text-on-primary font-label-bold text-label-bold px-lg py-md rounded-lg text-center mt-md min-h-[48px] flex items-center justify-center"
            onClick={() => { setMenuOpen(false); openAuthModal() }}
          >
            Login / Register
          </button>
        </div>
      )}
    </>
  )
}
