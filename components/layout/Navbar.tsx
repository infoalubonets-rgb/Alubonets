'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { openAuthModal } from '@/components/auth/AuthModal'
import { NAV_LINKS, SITE_LOGO } from '@/lib/constants'
import { homeForAccount, meLookup, type AuthUser } from '@/lib/auth/client'
import { readAccountHint } from '@/lib/auth/account-hint'

const CLOSE_MS = 280
const MOBILE_MENU_TITLE_ID = 'mobile-navigation-title'

/** Who the navbar shows: the confirmed user, or the browser's last-known account while checking. */
type NavAccount = Pick<AuthUser, 'fullName' | 'role' | 'isSuperAdmin'> & { avatarUrl?: string | null; email?: string }

function AccountAvatar({ user }: { user: NavAccount }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [user.avatarUrl])
  const letter = (user.fullName || user.email || 'A').trim().charAt(0).toUpperCase() || 'A'
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-white" aria-hidden="true">
      {user.avatarUrl && !failed
        ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
        : letter}
    </span>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  const [user, setUser] = useState<NavAccount | null>(null)
  // True until the first answer from the server; the login button waits for it so a signed-in
  // member never sees "Login / Register" flash and click it by mistake.
  const [checking, setChecking] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuShown, setMenuShown] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [backdropReady, setBackdropReady] = useState(false)

  useEffect(() => {
    let active = true
    let latest = 0
    const refresh = async () => {
      const request = ++latest
      const result = await meLookup()
      if (!active || request !== latest) return
      if (result.status === 'authenticated') setUser(result.user)
      else if (result.status === 'unauthenticated') setUser(null)
      setChecking(false)
    }
    // Show the last signed-in account at once; the server check below confirms or clears it.
    const hint = readAccountHint()
    if (hint) setUser((current) => current ?? hint)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    void refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pathname])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setMenuShown(false)
    setMenuOpen(false)
    setBackdropReady(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const show = window.requestAnimationFrame(() => {
      setMenuShown(true)
    })
    const enableBackdrop = window.setTimeout(() => setBackdropReady(true), 140)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(show)
      window.clearTimeout(enableBackdrop)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  function openMenu() {
    setMenuOpen(true)
  }

  function closeMenu() {
    setMenuShown(false)
    setBackdropReady(false)
    window.setTimeout(() => setMenuOpen(false), CLOSE_MS)
  }

  function toggleMenu(event: React.MouseEvent | React.PointerEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (menuOpen) closeMenu()
    else openMenu()
  }

  const drawer = menuOpen && mounted
    ? createPortal(
        <div className="fixed inset-0 z-[300] md:hidden" role="dialog" aria-modal="true" aria-labelledby={MOBILE_MENU_TITLE_ID}>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={backdropReady ? 0 : -1}
            className={`absolute inset-0 bg-[#001f50]/45 backdrop-blur-[2px] transition-opacity duration-300 ${
              menuShown && backdropReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={closeMenu}
          />
          <div
            className={`absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] max-w-full flex-col bg-surface shadow-[8px_0_32px_rgba(0,31,80,0.22)] transition-transform duration-300 ease-out ${
              menuShown ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-outline-variant px-md">
              <Link href="/" className="flex min-w-0 items-center gap-sm" onClick={closeMenu}>
                <img src={SITE_LOGO} alt="Alubonets SHG Logo" className="h-11 w-auto object-cover" />
                <span id={MOBILE_MENU_TITLE_ID} className="truncate font-h3 text-lg text-primary">
                  Alubonets
                </span>
              </Link>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-primary hover:bg-surface-container"
                aria-label="Close menu"
                onClick={closeMenu}
              >
                <span className="material-symbols-outlined text-[26px]">close</span>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto overscroll-contain px-md py-4">
              <ul className="flex flex-col gap-1">
                {NAV_LINKS.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`flex min-h-12 items-center rounded-xl px-3 py-3 text-[16px] transition-colors ${
                        isActive(href)
                          ? 'bg-secondary-container/15 font-bold text-secondary'
                          : 'font-medium text-primary hover:bg-surface-container'
                      }`}
                      onClick={closeMenu}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              {user ? (
                <Link href={homeForAccount(user)} onClick={closeMenu} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary-container px-lg py-3 font-label-bold text-on-primary">
                  <AccountAvatar user={user} />
                  My dashboard
                </Link>
              ) : checking ? (
                <span className="mt-4 block h-12 w-full animate-pulse rounded-xl bg-surface-container" aria-hidden="true" />
              ) : (
              <button
                type="button"
                className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-secondary-container px-lg py-3 font-label-bold text-on-primary"
                onClick={() => {
                  closeMenu()
                  window.setTimeout(() => openAuthModal(), CLOSE_MS)
                }}
              >
                Login / Register
              </button>
              )}
            </nav>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-outline-variant bg-surface dark:bg-surface-dim">
        <div className="mx-auto flex h-16 max-w-container-max items-center justify-between px-md sm:h-20 md:px-lg">
          <Link href="/" className="flex min-w-0 items-center gap-sm">
            <img src={SITE_LOGO} alt="Alubonets SHG Logo" className="h-11 w-auto object-cover sm:h-16" />
            <span className="truncate font-h3 text-lg text-primary sm:text-h3">Alubonets</span>
          </Link>

          <nav className="hidden h-full items-center gap-lg md:flex" aria-label="Primary">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`flex h-full items-center transition-transform active:scale-95 ${
                  isActive(href)
                    ? 'border-b-2 border-secondary-container pb-1 font-semibold text-secondary-container'
                    : 'font-medium text-primary transition-colors duration-200 hover:text-secondary-container dark:text-on-surface-variant'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-md">
            {user ? (
              <Link
                href={homeForAccount(user)}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-secondary-container px-3 py-2 font-label-bold text-on-primary transition-opacity hover:opacity-90"
                aria-label="My dashboard"
                title={`Signed in as ${user.fullName}. Open my dashboard`}
              >
                <AccountAvatar user={user} />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            ) : checking ? (
              <span className="hidden h-12 w-12 animate-pulse rounded-lg bg-surface-container md:block" aria-hidden="true" />
            ) : (
            <button
              type="button"
              className="hidden min-h-[48px] items-center justify-center rounded-lg bg-secondary-container px-md py-sm font-label-bold text-label-bold text-on-primary transition-opacity hover:opacity-90 md:flex"
              onClick={() => openAuthModal()}
            >
              Login / Register
            </button>
            )}
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-primary hover:bg-surface-container md:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls={MOBILE_MENU_TITLE_ID}
              onClick={toggleMenu}
              onPointerUp={(event) => event.stopPropagation()}
            >
              <span className="material-symbols-outlined pointer-events-none text-[26px]" aria-hidden="true">
                {menuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>
      </header>
      {drawer}
    </>
  )
}
