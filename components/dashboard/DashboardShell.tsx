'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { ADMIN_SIDEBAR_LOGO } from '@/lib/constants'
import { meRequest, type AuthUser, type Role } from '@/lib/auth/client'
import { ROLE_HOME, ROLE_LABEL } from '@/lib/auth/types'
import ThemeLoader from '@/components/ui/ThemeLoader'
import DashboardNav from './DashboardNav'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import DashboardNotifications from './DashboardNotifications'

export type NavItem = {
  icon: string
  label: string
  href?: string
  badge?: string
  active?: boolean
}

type Props = {
  role: Role
  title: string
  nav: NavItem[]
  children: ReactNode
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

  const weekday = now.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()
  const date = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`

  return (
    <time
      dateTime={now.toISOString()}
      className="live-date-badge shrink-0"
      title={now.toLocaleString()}
    >
      {weekday} {date}
    </time>
  )
}

export default function DashboardShell({ role, title, nav, children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isDark, setIsDark] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [unread, setUnread] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const [welcome, setWelcome] = useState('')
  const showWelcome = pathname === ROLE_HOME[role]

  useEffect(() => {
    setCollapsed(localStorage.getItem('dashSidebarCollapsed') === '1')
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchUnread = async () => {
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
    meRequest().then((u) => {
      if (!u) {
        router.replace('/login')
        return
      }
      setUser(u)
      const hour = new Date().getHours()
      const g = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
      setWelcome(`${g}, ${u.fullName.split(' ')[0]}.`)
    })
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
    setCollapsed((c) => {
      localStorage.setItem('dashSidebarCollapsed', c ? '0' : '1')
      return !c
    })
  }

  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('adminTheme', next ? 'dark' : 'light')
    setIsDark(next)
  }

  const onLogout = () => {
    setSigningOut(true)
    // Single navigation: the route clears cookies and redirects to login.
    window.location.assign(role === 'ADMIN' ? '/api/auth/logout?to=admin' : '/api/auth/logout')
  }

  if (signingOut) {
    return <ThemeLoader label="Signing out…" />
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background text-on-background dark:bg-[#060c1a] dark:text-blue-50">
      <aside
        className={`bg-primary dark:bg-[#0c1e42] text-on-primary fixed left-0 top-0 h-screen flex flex-col z-50 border-r border-white/[0.08] shadow-[2px_0_16px_rgba(0,0,0,0.28)] transition-[width] duration-300 ${collapsed ? 'w-[68px]' : 'w-56'}`}
      >
        <div
          className={`pt-lg pb-md flex items-center gap-sm border-b border-white/10 ${collapsed ? 'justify-center px-sm' : 'px-md'}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ADMIN_SIDEBAR_LOGO}
            alt="Alubonets"
            className="h-11 w-11 rounded-full bg-white/10 p-1 flex-shrink-0"
          />
          {!collapsed && (
            <div>
              <p className="font-h3 text-[19px] font-bold text-on-primary leading-none">Alubonets</p>
              <p className="text-[11px] text-primary-fixed-dim/60 mt-0.5 font-caption">
                {ROLE_LABEL[role]}
              </p>
            </div>
          )}
        </div>

        <DashboardNav
          nav={nav.map((item) =>
            item.href === '/announcements' && unread > 0
              ? { ...item, badge: String(unread) }
              : item
          )}
          collapsed={collapsed}
        />

        <div className={`py-md border-t border-white/10 space-y-sm ${collapsed ? 'px-sm' : 'px-md'}`}>
          <Link
            href="/profile"
            title={collapsed ? 'My profile' : undefined}
            className={`flex items-center gap-sm text-on-primary bg-white/10 hover:bg-white/15 text-[13px] font-label-bold transition-colors w-full rounded-lg px-sm py-[7px] ${collapsed ? 'justify-center' : ''}`}
          >
            <span className="material-symbols-outlined text-[17px]">account_circle</span>
            {!collapsed && 'My profile'}
          </Link>
          <Link
            href="/"
            title={collapsed ? 'Public site' : undefined}
            className={`flex items-center gap-sm text-primary-fixed-dim/60 hover:text-on-primary text-[13px] font-body-md transition-colors w-full ${collapsed ? 'justify-center' : ''}`}
          >
            <span className="material-symbols-outlined text-[17px]">public</span>
            {!collapsed && 'Public site'}
          </Link>
          <button
            type="button"
            onClick={onLogout}
            title={collapsed ? 'Sign Out' : undefined}
            className={`flex items-center gap-sm text-primary-fixed-dim/60 hover:text-on-primary text-[13px] font-body-md transition-colors w-full group ${collapsed ? 'justify-center' : ''}`}
          >
            <span className="material-symbols-outlined text-[17px] group-hover:text-secondary-container transition-colors">
              logout
            </span>
            {!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      <div
        className={`flex-1 flex flex-col h-screen min-h-0 min-w-0 transition-[margin] duration-300 ${collapsed ? 'ml-[68px]' : 'ml-56'}`}
      >
        <header
          className="bg-surface-container-lowest dark:bg-[#0d1729] border-b border-outline-variant dark:border-[#1a2d4f] shrink-0 z-40 flex items-center justify-between px-lg"
          style={{ height: 52 }}
        >
          <div className="flex items-center gap-md flex-1">
            <button
              type="button"
              onClick={toggleSidebar}
              className="text-on-surface-variant dark:text-blue-200/60 hover:text-primary transition-colors flex items-center"
              title={collapsed ? 'Expand menu' : 'Collapse menu'}
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                {collapsed ? 'menu' : 'menu_open'}
              </span>
            </button>
            <div className="relative flex-1 max-w-xs">
              <span
                className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline"
                style={{ fontSize: 17 }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Search…"
                className="w-full pl-9 pr-md py-1.5 bg-surface-container dark:bg-[#111f36] dark:text-blue-50 rounded-lg border border-outline-variant/60 dark:border-[#1e3461] focus:outline-none focus:ring-1 focus:ring-primary text-[13px] font-body-md"
              />
            </div>
          </div>
          <div className="flex items-center gap-md">
            {user && <WorkspaceSwitcher user={user} />}
            <button
              type="button"
              onClick={toggleTheme}
              className="text-on-surface-variant dark:text-blue-200/60 hover:text-primary transition-colors"
              title="Toggle theme"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <Link
              href="/announcements"
              className="relative text-on-surface-variant dark:text-blue-200/60 hover:text-primary transition-colors"
              title="Notifications"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                notifications
              </span>
              <span
                className={`absolute -top-1 -right-1 text-white text-[9px] font-bold px-1 rounded-full leading-[14px] ${
                  unread > 0 ? 'bg-secondary' : 'bg-outline/70'
                }`}
              >
                {unread}
              </span>
            </Link>

            {user ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-sm hover:opacity-90 transition-opacity"
                  title="My profile"
                >
                  <div className="text-right hidden sm:block">
                    <p className="font-label-bold text-[12px] text-on-surface dark:text-blue-50 leading-tight">
                      {user?.fullName}
                    </p>
                    <p className="text-[10px] text-on-surface-variant">{user?.role && ROLE_LABEL[user.role]}</p>
                  </div>
                  <div className="h-8 w-8 rounded-full border border-outline-variant bg-primary text-on-primary flex items-center justify-center font-label-bold text-[12px]">
                    {user?.initials}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-secondary-container/40 bg-secondary-container text-on-primary px-md py-1.5 font-label-bold text-[12px] hover:opacity-90 active:scale-95 transition-all shadow-sm"
                  title="Sign out"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-sm animate-pulse">
                <div className="hidden sm:block space-y-1.5">
                  <div className="h-3 w-20 rounded bg-on-surface/10" />
                  <div className="h-2.5 w-14 rounded bg-on-surface/10" />
                </div>
                <div className="h-8 w-8 rounded-full bg-on-surface/10" />
                <div className="h-8 w-20 rounded-lg bg-on-surface/10 hidden sm:block" />
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-lg space-y-lg">
          <div className="flex items-start justify-between shrink-0 -mt-1">
            <div>
              <h1 className="font-h2 text-h2 text-primary dark:text-primary-fixed-dim">{title}</h1>
              {showWelcome && welcome ? (
                <p className="font-body-md text-body-md text-on-surface-variant dark:text-blue-200/60 mt-xs">
                  {welcome}
                </p>
              ) : null}
            </div>
            <LiveDateBadge />
          </div>
          {children}
        </main>
      </div>
      <DashboardNotifications />
    </div>
  )
}
