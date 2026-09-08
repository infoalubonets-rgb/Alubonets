'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ADMIN_SIDEBAR_LOGO } from '@/lib/constants'
import { logoutRequest, meLookup, type AuthUser, type Role } from '@/lib/auth/client'
import { ROLE_LABEL } from '@/lib/auth/types'
import ThemeLoader from '@/components/ui/ThemeLoader'
import DashboardNav from './DashboardNav'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import DashboardNotifications from './DashboardNotifications'
import EmailSendProgressBanner from './EmailSendProgressBanner'

export type NavItem = {
  icon: string
  label: string
  href?: string
  badge?: string
  active?: boolean
  children?: NavItem[]
}

type Props = {
  role: Role
  title: string
  nav: NavItem[]
  children: ReactNode
  hidePageHeading?: boolean
  /** Hide sibling page pills in the header (e.g. Document repository). */
  hideRelatedLinks?: boolean
  pageAction?: ReactNode
}

function LiveDateBadge() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

  if (!now) return <span className="live-date-badge shrink-0" />

  const date = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <time
      dateTime={now.toISOString()}
      className="live-date-badge shrink-0"
      title={now.toLocaleString()}
    >
      {date}
    </time>
  )
}

const SIDEBAR_MIN_WIDTH = 200
const SIDEBAR_MAX_WIDTH = 380
const SIDEBAR_DEFAULT_WIDTH = 224
const SIDEBAR_COLLAPSED_WIDTH = 68
const MOBILE_DRAWER_WIDTH = 308

export default function DashboardShell({
  role,
  title,
  nav,
  children,
  hidePageHeading = false,
  hideRelatedLinks = false,
  pageAction,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isDark, setIsDark] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH)
  const [resizing, setResizing] = useState(false)
  const [unread, setUnread] = useState(0)
  const [paymentNotifCount, setPaymentNotifCount] = useState(0)
  const [supportUnread, setSupportUnread] = useState(0)
  const [supportBellCount, setSupportBellCount] = useState(0)
  const [supportToast, setSupportToast] = useState(false)
  const previousSupportUnread = useRef<number | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [emailsSending, setEmailsSending] = useState(false)
  const [welcome, setWelcome] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const pageScrollRef = useRef<HTMLElement>(null)
  const [pageScrollbar, setPageScrollbar] = useState({ visible: false, top: 0, height: 0 })
  const displayRole = user?.isSuperAdmin
    ? 'Super Administrator'
    : user?.role === 'ADMIN'
      ? 'Administrator'
      : role === 'MEMBER' && user?.isPrincipal
        ? 'Principal Member'
        : ROLE_LABEL[role]
  const isOverviewPage = pathname === '/admin' || /^\/dashboard\/(member|treasurer|executive|secretary|organizer)$/.test(pathname)
  const notificationTotal = unread + supportBellCount + paymentNotifCount
  const activeNavGroup = nav.reduce<{ item: NavItem; score: number } | null>((best, item) => {
    const score = [item, ...(item.children || [])].reduce((longest, candidate) => {
      const href = candidate.href
      return href && (pathname === href || pathname.startsWith(`${href}/`))
        ? Math.max(longest, href.length)
        : longest
    }, 0)
    return score > (best?.score || 0) ? { item, score } : best
  }, null)?.item
  const pageLinks = activeNavGroup
    ? [activeNavGroup, ...(activeNavGroup.children || [])].filter((item) => item.href)
    : []
  const selectedPageHref = pageLinks
    .map((item) => item.href!)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0]
  const relatedPageLinks = pageLinks.filter((item) => item.href !== selectedPageHref)

  useEffect(() => {
    setCollapsed(localStorage.getItem('dashSidebarCollapsed') === '1')
    setSupportBellCount(Number(localStorage.getItem('supportBellCount') || '0'))
    const savedWidth = Number(localStorage.getItem('dashSidebarWidth'))
    if (savedWidth >= SIDEBAR_MIN_WIDTH && savedWidth <= SIDEBAR_MAX_WIDTH) {
      setSidebarWidth(savedWidth)
    }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => {
      setIsDesktop(mq.matches)
      if (mq.matches) setMobileNavOpen(false)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!resizing) return
    const onMouseMove = (event: MouseEvent) => {
      const next = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, event.clientX))
      setSidebarWidth(next)
    }
    const onMouseUp = () => {
      setResizing(false)
      setSidebarWidth((current) => {
        localStorage.setItem('dashSidebarWidth', String(current))
        return current
      })
    }
    document.body.classList.add('select-none')
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      document.body.classList.remove('select-none')
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [resizing])

  useEffect(() => {
    const element = pageScrollRef.current
    if (!element) return
    const update = () => {
      const visible = element.scrollHeight > element.clientHeight + 1
      const height = visible ? Math.max(24, (element.clientHeight / element.scrollHeight) * element.clientHeight) : 0
      const travel = Math.max(0, element.clientHeight - height)
      const maxScroll = Math.max(1, element.scrollHeight - element.clientHeight)
      setPageScrollbar({ visible, height, top: (element.scrollTop / maxScroll) * travel })
    }
    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    const contentObserver = new MutationObserver(update)
    contentObserver.observe(element, { childList: true, subtree: true })
    return () => { element.removeEventListener('scroll', update); observer.disconnect(); contentObserver.disconnect() }
  }, [pathname, hidePageHeading])

  // Payment notification badge (treasurer/admin only)
  useEffect(() => {
    if (role !== 'TREASURER' && role !== 'ADMIN') return
    let cancelled = false

    const fetchPaymentCount = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        // Check localStorage for when the user last viewed notifications
        const lastSeen = Number(localStorage.getItem('treasurer-notif-seen-ts') || '0')
        const res = await fetch('/api/treasurer/payment-count')
        if (!res.ok || cancelled) return
        const { count } = await res.json() as { count: number }
        // Only show badge if there are payments newer than last-seen timestamp
        if (!cancelled) setPaymentNotifCount(lastSeen ? count : count)
      } catch {}
    }

    fetchPaymentCount()
    const id = setInterval(fetchPaymentCount, 60_000)
    // Clear badge when user views the notifications page
    const onViewed = () => setPaymentNotifCount(0)
    window.addEventListener('payment-notifications-viewed', onViewed)
    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener('payment-notifications-viewed', onViewed)
    }
  }, [role])

  useEffect(() => {
    let cancelled = false
    let toastTimer: number | undefined
    const check = () => document.visibilityState === 'visible' ? fetch('/api/support-chat/unread').then(r => r.ok ? r.json() : null).then(data => {
      if (cancelled || !data) return
      const next = Number(data.count || 0)
      if (next > 0 && (previousSupportUnread.current === null || next > previousSupportUnread.current)) {
        setSupportBellCount(current => {
          const updated = Math.max(current, next)
          localStorage.setItem('supportBellCount', String(updated))
          return updated
        })
        setSupportToast(true)
        window.clearTimeout(toastTimer)
        toastTimer = window.setTimeout(() => setSupportToast(false), 5500)
      }
      previousSupportUnread.current = next
      setSupportUnread(next)
    }).catch(() => {}) : Promise.resolve()
    const onRead = () => { previousSupportUnread.current = 0; setSupportUnread(0); setSupportToast(false) }
    window.addEventListener('support-chat-read', onRead)
    check(); const id = window.setInterval(check, 15_000)
    return () => { cancelled = true; window.clearInterval(id); window.clearTimeout(toastTimer); window.removeEventListener('support-chat-read', onRead) }
  }, [pathname])

  useEffect(() => {
    let cancelled = false
    const fetchUnread = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/announcements/unread')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setUnread(data.count ?? 0)
      } catch {
        // ignore — badge just keeps its last value
      }
    }
    fetchUnread()
    const id = window.setInterval(fetchUnread, 60_000)
    window.addEventListener('announcements-read', fetchUnread)
    window.addEventListener('new-announcement', fetchUnread)
    return () => {
      cancelled = true
      window.clearInterval(id)
      window.removeEventListener('announcements-read', fetchUnread)
      window.removeEventListener('new-announcement', fetchUnread)
    }
  }, [pathname])

  useEffect(() => {
    const saved = localStorage.getItem('adminTheme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = saved === 'dark' || (!saved && prefersDark)
    setIsDark(dark)
    document.documentElement.classList.toggle('dark', dark)
  }, [])

  useEffect(() => {
    let cancelled = false
    let retryTimer: number | undefined
    let attempts = 0

    const loadUser = async () => {
      const result = await meLookup()
      if (cancelled) return

      if (result.status === 'authenticated') {
        setUser(result.user)
        const hour = new Date().getHours()
        const g = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
        setWelcome(`${g}, ${result.user.fullName.split(' ')[0]}`)
        return
      }

      if (result.status === 'unavailable') {
        // Keep the shell up across tab switches / brief server blips; retry quietly.
        attempts += 1
        if (attempts < 8) {
          retryTimer = window.setTimeout(loadUser, 1500 * Math.min(attempts, 4))
        }
        return
      }

      // Confirmed unauthenticated — only then send to login
      router.replace('/login')
    }

    loadUser()
    return () => {
      cancelled = true
      window.clearTimeout(retryTimer)
    }
  }, [router])

  useEffect(() => {
    document.documentElement.classList.add('h-full')
    document.body.classList.add('h-full', 'overflow-hidden')
    return () => {
      document.documentElement.classList.remove('h-full')
      document.body.classList.remove('h-full', 'overflow-hidden')
    }
  }, [])

  const toggleSidebar = () => {
    if (!isDesktop) {
      setMobileNavOpen((open) => !open)
      return
    }
    setCollapsed((c) => {
      localStorage.setItem('dashSidebarCollapsed', c ? '0' : '1')
      return !c
    })
  }

  const sidebarCollapsed = isDesktop && collapsed
  const desktopSidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth
  const drawerWidth = MOBILE_DRAWER_WIDTH
  const asideWidth = isDesktop ? desktopSidebarWidth : drawerWidth
  const contentMargin = isDesktop ? desktopSidebarWidth : 0
  const menuOpen = isDesktop ? !collapsed : mobileNavOpen

  const toggleTheme = () => {
    document.documentElement.classList.add('theme-transitioning')
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('adminTheme', next ? 'dark' : 'light')
    setIsDark(next)
    window.setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 420)
  }

  const onLogout = () => {
    if (emailsSending) return
    setSigningOut(true)
    // Clear cookies with a bounded request, then navigate regardless of the
    // outcome — a slow/hanging network call must never stall the redirect.
    logoutRequest().finally(() => {
      window.location.assign(role === 'ADMIN' ? '/admin/login' : '/login')
    })
  }

  if (signingOut) {
    return <ThemeLoader label="Signing out…" />
  }

  return (
    <div className="dashboard-shell h-[100dvh] flex overflow-hidden bg-background text-on-background dark:bg-[#071426] dark:text-blue-50">
      {(role === 'ADMIN' || user?.isSuperAdmin) && pathname.startsWith('/admin/announcements') && <EmailSendProgressBanner onActiveChange={setEmailsSending} />}

      {!isDesktop && mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-[45] bg-[#001f50]/50 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        style={{ width: asideWidth }}
        className={`bg-primary dark:bg-[#03112b] text-on-primary fixed left-0 top-0 h-[100dvh] flex flex-col z-50 border-r border-white/[0.08] shadow-[2px_0_16px_rgba(0,0,0,0.28)] ${
          resizing ? '' : 'transition-[width,transform] duration-300'
        } ${isDesktop || mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          className={`pt-lg pb-md flex items-center gap-sm border-b border-white/10 ${sidebarCollapsed ? 'justify-center px-sm' : 'px-md'}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ADMIN_SIDEBAR_LOGO}
            alt="Alubonets"
            className="h-11 w-11 rounded-full bg-white/10 p-1 flex-shrink-0"
          />
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="font-h3 text-[19px] font-bold text-on-primary leading-none">Alubonets</p>
              <p className="text-[11px] text-primary-fixed-dim/60 mt-0.5 font-caption truncate">
                {displayRole}
              </p>
            </div>
          )}
          {!isDesktop && (
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-primary/80 hover:bg-white/10"
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          )}
        </div>

        <DashboardNav
          nav={nav.filter(item => item.href !== '/support-chat').map(function addBadges(item): NavItem {
            const children = item.children?.map(addBadges)
            if ((item.href === '/announcements' || item.href === '/admin/announcements') && unread > 0)
              return { ...item, children, badge: String(unread) }
            if (item.href === '/dashboard/treasurer/notifications' && paymentNotifCount > 0)
              return { ...item, children, badge: String(paymentNotifCount) }
            return children ? { ...item, children } : item
          })}
          collapsed={sidebarCollapsed}
          onNavigate={() => setMobileNavOpen(false)}
        />

        <div className={`py-md border-t border-white/10 space-y-sm ${sidebarCollapsed ? 'px-sm' : 'px-md'}`}>
          <Link
            href="/profile"
            onClick={() => setMobileNavOpen(false)}
            title={sidebarCollapsed ? 'My profile' : undefined}
            className={`flex min-h-11 items-center gap-sm text-on-primary bg-white/10 hover:bg-white/15 text-[13px] font-label-bold transition-colors w-full rounded-lg px-sm py-2.5 ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
            <span className="material-symbols-outlined text-[17px]">account_circle</span>
            {!sidebarCollapsed && 'My profile'}
          </Link>
          <Link
            href="/"
            onClick={() => setMobileNavOpen(false)}
            title={sidebarCollapsed ? 'Public site' : undefined}
            className={`flex min-h-11 items-center gap-sm text-primary-fixed-dim/60 hover:text-on-primary text-[13px] font-body-md transition-colors w-full ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
            <span className="material-symbols-outlined text-[17px]">public</span>
            {!sidebarCollapsed && 'Public site'}
          </Link>
          <button
            type="button"
            onClick={onLogout}
            disabled={emailsSending}
            title={emailsSending ? 'Finish sending notification emails before signing out' : sidebarCollapsed ? 'Sign Out' : undefined}
            className={`flex min-h-11 items-center gap-sm text-primary-fixed-dim/60 hover:text-on-primary text-[13px] font-body-md transition-colors w-full group disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-primary-fixed-dim/60 ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
            <span className="material-symbols-outlined text-[17px] group-hover:text-secondary-container transition-colors">
              logout
            </span>
            {!sidebarCollapsed && (emailsSending ? 'Sending emails…' : 'Sign Out')}
          </button>
        </div>

        {isDesktop && !sidebarCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onMouseDown={(event) => {
              event.preventDefault()
              setResizing(true)
            }}
            onDoubleClick={() => {
              setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)
              localStorage.setItem('dashSidebarWidth', String(SIDEBAR_DEFAULT_WIDTH))
            }}
            className="group absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none"
          >
            <span className="absolute inset-y-0 right-0 w-px bg-white/0 transition-colors group-hover:bg-white/25" />
          </div>
        )}
      </aside>

      <div
        style={{ marginLeft: contentMargin }}
        className={`relative flex-1 flex flex-col h-[100dvh] min-h-0 min-w-0 ${resizing ? '' : 'transition-[margin] duration-300'}`}
      >
        <header
          className="relative bg-surface-container-lowest dark:bg-[#091a30] border-b border-outline-variant/70 dark:border-[#173056] shrink-0 z-40 flex items-center justify-between gap-2 px-3 sm:px-5 md:px-lg shadow-[0_2px_10px_rgba(0,31,80,0.035)] before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-primary dark:before:bg-primary-container"
          style={{ height: 66 }}
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3 md:gap-md">
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-secondary-container transition-colors hover:bg-secondary-container/10"
              title={menuOpen ? 'Close menu' : 'Open menu'}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                {menuOpen ? 'menu_open' : 'menu'}
              </span>
            </button>
            <div className="min-w-0 hidden sm:block">
              <p className="truncate text-[13px] font-label-bold leading-tight text-on-surface dark:text-blue-50">
                {welcome}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-4">
            <div className="hidden lg:block"><LiveDateBadge /></div>
            {user && (
              <div className="hidden md:block">
                <WorkspaceSwitcher user={user} />
              </div>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant dark:text-blue-200/60 hover:bg-surface-container dark:hover:bg-[#111f36] hover:text-primary transition-colors"
              title="Toggle theme"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <Link
              href={supportBellCount > 0 ? '/support-chat' : '/announcements'}
              onClick={() => { setSupportBellCount(0); localStorage.removeItem('supportBellCount') }}
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant dark:text-blue-200/60 hover:bg-surface-container dark:hover:bg-[#111f36] hover:text-primary transition-colors"
              title="Notifications"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                notifications
              </span>
              {notificationTotal > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-secondary px-1 text-center text-[9px] font-bold leading-[18px] text-white shadow-sm">+{notificationTotal}</span>}
            </Link>

            {user ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-sm hover:opacity-90 transition-opacity"
                  title="My profile"
                >
                  <div className="text-right hidden lg:block">
                    <p className="font-label-bold text-[12px] text-on-surface dark:text-blue-50 leading-tight">
                      {user?.fullName}
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      {user?.isSuperAdmin
                        ? 'Super Administrator'
                        : user?.role === 'ADMIN'
                          ? 'Administrator'
                          : user?.role === 'MEMBER' && user.isPrincipal
                            ? 'Principal Member'
                            : user?.role && ROLE_LABEL[user.role]}
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-full border-2 border-white dark:border-[#1e3461] bg-primary text-on-primary flex items-center justify-center font-label-bold text-[12px] shadow-sm">
                    {user?.initials}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={emailsSending}
                  className="hidden sm:inline-flex h-10 items-center gap-1.5 rounded-full border border-secondary-container/40 bg-secondary-container text-on-primary px-3 md:px-4 font-label-bold text-[12px] hover:opacity-90 active:scale-95 transition-all shadow-[0_3px_10px_rgba(254,128,21,0.22)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
                  title={emailsSending ? 'Finish sending notification emails before signing out' : 'Sign out'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                  <span className="hidden md:inline">{emailsSending ? 'Sending…' : 'Sign out'}</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-sm animate-pulse">
                <div className="h-8 w-8 rounded-full bg-on-surface/10" />
              </div>
            )}
          </div>
        </header>

        <main ref={pageScrollRef} className="dashboard-page-scroll relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 sm:px-4 md:px-6 lg:px-lg pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:pt-4 space-y-4 sm:space-y-lg">
          {!hidePageHeading && (
            <div className="shrink-0 pt-1 sm:pt-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2">
                <div className="min-w-0">
                  <h1 className="font-h2 text-[22px] sm:text-[26px] md:text-[28px] leading-tight text-primary dark:text-primary-fixed-dim">{title}</h1>
                  {isOverviewPage && <p className="mt-1 text-sm text-on-surface-variant dark:text-blue-200/60">{displayRole}</p>}
                </div>
                {pageAction && <div className="w-full sm:w-auto shrink-0">{pageAction}</div>}
                {!hideRelatedLinks && relatedPageLinks.length > 0 && (
                  <nav aria-label={`Related ${activeNavGroup?.label} pages`} className="flex w-full sm:w-auto shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    {relatedPageLinks.map((item) => {
                      const href = item.href!
                      return (
                        <Link
                          key={href}
                          href={href}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-primary/30 bg-primary px-3.5 text-[12px] font-label-bold text-on-primary shadow-[0_3px_10px_rgba(0,31,80,0.18)] transition hover:border-secondary-container/50 hover:bg-secondary-container active:scale-[0.98] dark:border-primary-container/40 dark:bg-primary-container dark:hover:bg-secondary-container"
                        >
                          <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                          {item.label}
                          {item.badge && <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] leading-none text-white">{item.badge}</span>}
                        </Link>
                      )
                    })}
                  </nav>
                )}
              </div>
            </div>
          )}
          {children}
        </main>
        {pageScrollbar.visible && <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-px top-[66px] z-50 hidden w-px overflow-hidden md:block"><span className="absolute right-0 top-0 w-px rounded-full bg-[#ffc400]" style={{ height: pageScrollbar.height, transform: `translateY(${pageScrollbar.top}px)` }} /></span>}
      </div>
      {supportToast && (
        <Link href="/support-chat" onClick={() => setSupportToast(false)} className="fixed bottom-24 left-4 right-4 z-[90] flex max-w-sm items-start gap-3 rounded-2xl border border-orange-200 bg-white p-4 text-slate-900 shadow-[0_18px_55px_rgba(0,31,80,.22)] transition hover:-translate-y-0.5 sm:left-auto sm:right-5 sm:w-[310px] dark:border-orange-500/30 dark:bg-[#102039] dark:text-white">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-white"><span className="material-symbols-outlined text-[21px]">mark_chat_unread</span></span>
          <span className="min-w-0"><span className="flex items-center justify-between"><b className="text-sm">New support message</b><span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-white">+{supportUnread}</span></span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-blue-100/60">You have a new reply. Click to open the conversation.</span></span>
        </Link>
      )}
      <Link
        href="/support-chat"
        aria-label="Open support chat"
        title="Support chat"
        className="group fixed z-[85] flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff8b24] to-[#f56b00] text-white shadow-[0_12px_30px_rgba(245,107,0,.38)] transition hover:-translate-y-1 hover:shadow-[0_16px_38px_rgba(245,107,0,.48)] right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:right-5"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>
        {supportUnread > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full border-2 border-white bg-primary px-1 text-[10px] font-bold text-white">+{supportUnread}</span>}
        <span className="pointer-events-none absolute right-16 whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 hidden sm:block">Chat with support</span>
      </Link>
      <DashboardNotifications />
    </div>
  )
}
