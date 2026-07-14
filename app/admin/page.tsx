'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'

const ADMIN_LOGO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCfzzgw1iT_ZR6bjpmnVBu1xcYQITMpBnIaB5l2rRE7oL4gxxtovKMSTMNkC-Zu89sT2OyMUUgq1PMi5UoYMcVgcEclv0hqQ3O9ArvnGh5LMuvlEZP-8-xD5MGs9Cs5N_0OzTBoaVaNKg6zTHXhAzW29VvPjEVpqW2M6WPfYY-QmrFp4WCGIM5h7NSRT-aWWZ6LGvjnxGJHCR5SHv2TLNqytsiWuQLXD8L8833BClookPeihPT5XiY3yyqZjr8fMOY8BHA'

const SIDEBAR_LOGO =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAdftVT0b5kRl1qFFsclxaUAbXkDvijpgsYIZwtlv-i0BPSIPnLvPIu2ogx0ddz-HKa8BYpLouaIS-_zCjRCi89EtRrqBjGiAALHMFQ7l1vdNH8FqsYT0ZRKvPpcIimPglYSDOokQdCvH4KfZ06-A2jQpBWh81fRP1zJSZGv-m2Mjm5cOI2dgAYs-XDFFuAM4NhmYLnTkPoOEPLcqBx6yYLVH22UdYeHYZq9344zgQpfFoLSIwQB53hT0Ouy4cZkEhnYQE'

const PENDING = [
  { name: 'Michael Ochieng', phone: '+254 712 345 678', date: 'Oct 24, 2023', alt: false },
  { name: 'Sarah Wangari', phone: '+254 722 987 654', date: 'Oct 23, 2023', alt: true },
  { name: 'David Kipkorir', phone: '+254 733 456 789', date: 'Oct 21, 2023', alt: false },
]

const SIDEBAR_LINKS: { icon: string; label: string; badge?: string; active?: boolean }[] = [
  { icon: 'dashboard', label: 'Dashboard', active: true },
  { icon: 'person_add', label: 'Pending', badge: '7' },
  { icon: 'group', label: 'Members' },
  { icon: 'admin_panel_settings', label: 'Roles & Permissions' },
  { icon: 'payments', label: 'Contributions' },
  { icon: 'assignment', label: 'Projects' },
  { icon: 'event', label: 'Events' },
  { icon: 'photo_library', label: 'Gallery' },
  { icon: 'folder', label: 'Documents' },
  { icon: 'analytics', label: 'Reports' },
  { icon: 'history', label: 'Audit Logs' },
  { icon: 'settings', label: 'Settings' },
]

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail] = useState('admin@alubonets.com')
  const [password, setPassword] = useState('admin123')
  const [showPw, setShowPw] = useState(false)
  const [loginError, setLoginError] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [welcome, setWelcome] = useState("Welcome back. Here's what's happening today.")

  useEffect(() => {
    const saved = localStorage.getItem('adminTheme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = saved === 'dark' || (!saved && prefersDark)
    setIsDark(dark)
    document.documentElement.classList.toggle('dark', dark)
  }, [])

  useEffect(() => {
    if (!loggedIn) return
    const update = () => {
      const adminName = localStorage.getItem('adminName') || 'Collins'
      setWelcome(`${greetingForHour(new Date().getHours())}, ${adminName}.`)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [loggedIn])

  useEffect(() => {
    if (loggedIn) {
      document.body.classList.add('overflow-hidden', 'h-full')
    } else {
      document.body.classList.remove('overflow-hidden', 'h-full')
    }
    return () => {
      document.body.classList.remove('overflow-hidden', 'h-full')
    }
  }, [loggedIn])

  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('adminTheme', next ? 'dark' : 'light')
    setIsDark(next)
  }

  const onLogin = (e: FormEvent) => {
    e.preventDefault()
    if (email.trim() && password) {
      setLoginError(false)
      setLoggedIn(true)
    } else {
      setLoginError(true)
    }
  }

  const onLogout = () => {
    setLoggedIn(false)
    setEmail('')
    setPassword('')
  }

  if (!loggedIn) {
    return (
      <div className="fixed inset-0 z-[200] bg-primary flex items-center justify-center min-h-screen px-md">
        <div className="w-full max-w-[360px]">
          <div className="flex justify-center">
            <div className="mb-[-30px] relative z-10 bg-surface rounded-2xl px-md py-sm shadow-xl border border-outline-variant/30">
              <img src={ADMIN_LOGO} alt="Alubonets SHG" className="h-12 w-auto object-contain" />
            </div>
          </div>
          <div className="bg-surface rounded-2xl pt-[52px] pb-lg px-lg shadow-2xl border border-white/10">
            <div className="text-center mb-lg">
              <h1 className="font-h3 text-h3 text-secondary-container">Admin Login</h1>
            </div>
            <form onSubmit={onLogin} className="flex flex-col gap-md">
              <div>
                <label className="block font-label-bold text-label-bold text-on-surface-variant mb-xs text-[13px]">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@alubonets.com"
                  required
                  className="w-full px-md py-[10px] bg-surface border border-secondary-container rounded-lg text-on-surface placeholder-on-surface/30 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary-container/40 font-body-md text-[14px] transition-all"
                />
              </div>
              <div>
                <label className="block font-label-bold text-label-bold text-on-surface-variant mb-xs text-[13px]">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-md py-[10px] pr-[44px] bg-surface border border-secondary-container rounded-lg text-on-surface placeholder-on-surface/30 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary-container/40 font-body-md text-[14px] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-sm top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors p-xs"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPw ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
              {loginError && (
                <p className="text-error text-center font-caption text-caption text-[12px]">
                  Invalid credentials. Please try again.
                </p>
              )}
              <div className="flex justify-center mt-xs">
                <button
                  type="submit"
                  className="bg-secondary-container text-on-secondary font-label-bold text-label-bold py-[11px] px-xl rounded-full hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-sm min-h-[44px] shadow-md"
                >
                  <span className="material-symbols-outlined text-[17px]">lock_open</span>
                  Sign In
                </button>
              </div>
            </form>
          </div>
          <p className="text-center mt-lg">
            <Link
              href="/"
              className="font-caption text-caption text-primary-fixed-dim/50 hover:text-primary-fixed-dim transition-colors"
            >
              ← Return to public site
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-background text-on-background dark:bg-[#060c1a] dark:text-blue-50">
      <aside className="bg-primary dark:bg-[#0c1e42] text-on-primary w-56 fixed left-0 top-0 h-screen flex flex-col z-50 border-r border-white/[0.08] dark:border-white/[0.06] shadow-[2px_0_16px_rgba(0,0,0,0.28)] transition-colors">
        <div className="px-md pt-lg pb-md flex items-center gap-sm border-b border-white/10">
          <img
            src={SIDEBAR_LOGO}
            alt="Alubonets"
            className="h-11 w-11 rounded-full bg-white/10 p-1 flex-shrink-0"
          />
          <div>
            <p className="font-h3 text-[19px] font-bold text-on-primary leading-none">Alubonets</p>
            <p className="text-[11px] text-primary-fixed-dim/60 mt-0.5 font-caption">Admin Panel</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-sm px-sm space-y-0.5">
          {SIDEBAR_LINKS.map(link =>
            link.active ? (
              <a
                key={link.label}
                href="#"
                className="flex items-center gap-sm px-sm py-[7px] rounded-lg bg-secondary-container/20 text-on-primary font-label-bold text-[13.5px]"
              >
                <span className="material-symbols-outlined text-[17px] text-secondary-container flex-shrink-0">
                  {link.icon}
                </span>
                {link.label}
              </a>
            ) : (
              <a key={link.label} href="#" className="sidebar-link">
                <span className="material-symbols-outlined">{link.icon}</span>
                {link.badge ? (
                  <>
                    <span className="flex-1">{link.label}</span>
                    <span className="bg-secondary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {link.badge}
                    </span>
                  </>
                ) : (
                  link.label
                )}
              </a>
            )
          )}
        </nav>

        <div className="px-md py-md border-t border-white/10">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-sm text-primary-fixed-dim/60 hover:text-on-primary text-[13px] font-body-md transition-colors w-full group"
          >
            <span className="material-symbols-outlined text-[17px] group-hover:text-secondary-container transition-colors">
              logout
            </span>
            Sign Out
          </button>
        </div>
      </aside>

      <div className="ml-56 flex-1 flex flex-col min-h-screen min-w-0">
        <header
          className="bg-surface-container-lowest dark:bg-[#0d1729] border-b border-outline-variant dark:border-[#1a2d4f] sticky top-0 z-40 flex items-center justify-between px-lg transition-colors"
          style={{ height: 52 }}
        >
          <div className="relative flex-1 max-w-xs">
            <span
              className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline"
              style={{ fontSize: 17 }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="Search members, reports…"
              className="w-full pl-9 pr-md py-1.5 bg-surface-container dark:bg-[#111f36] dark:text-blue-50 rounded-lg border border-outline-variant/60 dark:border-[#1e3461] focus:outline-none focus:ring-1 focus:ring-primary text-[13px] font-body-md"
            />
          </div>
          <div className="flex items-center gap-md">
            <button
              type="button"
              onClick={toggleTheme}
              className="text-on-surface-variant dark:text-blue-200/60 hover:text-primary dark:hover:text-primary-fixed-dim transition-colors"
              title="Toggle theme"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <button
              type="button"
              className="relative text-on-surface-variant dark:text-blue-200/60 hover:text-primary dark:hover:text-primary-fixed-dim transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                notifications
              </span>
              <span className="absolute -top-1 -right-1 bg-secondary text-white text-[9px] font-bold px-1 rounded-full leading-[14px]">
                3
              </span>
            </button>
            <div className="flex items-center gap-sm cursor-pointer group">
              <div className="text-right hidden sm:block">
                <p className="font-label-bold text-[12px] text-on-surface dark:text-blue-50 leading-tight">
                  Admin
                </p>
              </div>
              <div className="h-8 w-8 rounded-full border border-outline-variant dark:border-[#1e3461] bg-primary text-on-primary flex items-center justify-center font-label-bold text-[12px] flex-shrink-0">
                C
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-lg space-y-lg overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-h2 text-h2 text-primary dark:text-primary-fixed-dim">Dashboard</h1>
              <p className="font-body-md text-body-md text-on-surface-variant dark:text-blue-200/60 mt-xs">
                {welcome}
              </p>
            </div>
            <span className="font-caption text-caption text-on-surface-variant dark:text-blue-200/60 bg-surface-container dark:bg-[#0d1729] px-md py-xs rounded-full border border-outline-variant dark:border-[#1a2d4f]">
              July 2026
            </span>
          </div>

          <section className="grid grid-cols-2 lg:grid-cols-5 gap-md">
            <div className="bg-surface-container-lowest dark:bg-[#0d1729] rounded-xl border border-outline-variant dark:border-[#1a2d4f] p-md flex flex-col gap-sm hover:shadow-[0_2px_12px_rgba(0,31,80,0.07)] transition-all duration-200 group">
              <div className="flex justify-between items-start">
                <p className="font-caption text-[11px] text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
                  Total Members
                </p>
                <div className="bg-primary-fixed/50 dark:bg-primary/30 p-1.5 rounded-lg text-primary dark:text-primary-fixed-dim group-hover:bg-primary-fixed transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    group
                  </span>
                </div>
              </div>
              <p className="font-h3 text-h3 text-on-surface dark:text-blue-50 mt-xs">152</p>
            </div>

            <div className="bg-surface-container-lowest dark:bg-[#0d1729] rounded-xl border border-outline-variant dark:border-[#1a2d4f] p-md flex flex-col gap-sm hover:shadow-[0_2px_12px_rgba(0,31,80,0.07)] transition-all duration-200 group">
              <div className="flex justify-between items-start">
                <p className="font-caption text-[11px] text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
                  Active
                </p>
                <div className="bg-[#dcfce7] dark:bg-[#14532d]/40 p-1.5 rounded-lg text-[#166534] dark:text-[#4ade80] group-hover:bg-[#bbf7d0] transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    verified_user
                  </span>
                </div>
              </div>
              <p className="font-h3 text-h3 text-on-surface dark:text-blue-50 mt-xs">145</p>
            </div>

            <div className="bg-surface-container-lowest dark:bg-[#0d1729] rounded-xl border-2 border-secondary-container/30 p-md flex flex-col gap-sm relative overflow-hidden hover:shadow-[0_2px_12px_rgba(254,128,21,0.12)] transition-all duration-200">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-secondary-container" />
              <div className="flex justify-between items-start">
                <p className="font-caption text-[11px] text-secondary dark:text-secondary-container font-bold uppercase tracking-wider">
                  Pending
                </p>
                <div className="bg-secondary-fixed/50 dark:bg-secondary/30 p-1.5 rounded-lg text-secondary dark:text-secondary-container">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    hourglass_empty
                  </span>
                </div>
              </div>
              <p className="font-h3 text-h3 text-secondary dark:text-secondary-container mt-xs">7</p>
            </div>

            <div className="bg-surface-container-lowest dark:bg-[#0d1729] rounded-xl border border-outline-variant dark:border-[#1a2d4f] p-md flex flex-col gap-sm hover:shadow-[0_2px_12px_rgba(0,31,80,0.07)] transition-all duration-200 group">
              <div className="flex justify-between items-start">
                <p className="font-caption text-[11px] text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
                  Contributions
                </p>
                <div className="bg-tertiary-fixed/50 dark:bg-tertiary/50 p-1.5 rounded-lg text-tertiary dark:text-tertiary-fixed group-hover:bg-tertiary-fixed transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    payments
                  </span>
                </div>
              </div>
              <p className="font-h3 text-h3 text-on-surface dark:text-blue-50 mt-xs">KES 45k</p>
            </div>

            <div className="bg-surface-container-lowest dark:bg-[#0d1729] rounded-xl border border-outline-variant dark:border-[#1a2d4f] p-md flex flex-col gap-sm hover:shadow-[0_2px_12px_rgba(0,31,80,0.07)] transition-all duration-200 group">
              <div className="flex justify-between items-start">
                <p className="font-caption text-[11px] text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wider">
                  Events
                </p>
                <div className="bg-primary-fixed/50 dark:bg-primary/30 p-1.5 rounded-lg text-primary dark:text-primary-fixed-dim group-hover:bg-primary-fixed transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    event
                  </span>
                </div>
              </div>
              <p className="font-h3 text-h3 text-on-surface dark:text-blue-50 mt-xs">2</p>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
            <div className="lg:col-span-2 space-y-lg">
              <div className="bg-surface-container-lowest dark:bg-[#0d1729] rounded-xl border border-outline-variant dark:border-[#1a2d4f] overflow-hidden">
                <div className="px-lg py-md border-b border-surface-container-highest dark:border-[#1a2d4f] flex justify-between items-center">
                  <h2 className="font-h3 text-h3 text-primary dark:text-primary-fixed-dim">
                    Pending Registrations
                  </h2>
                  <button
                    type="button"
                    className="text-secondary dark:text-secondary-container font-label-bold text-label-bold hover:underline text-[13px]"
                  >
                    View All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-surface-container-low dark:bg-[#111f36]/40 border-b border-surface-container-highest dark:border-[#1a2d4f]">
                        <th className="py-2.5 px-lg font-label-bold text-[12px] text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wide">
                          Name
                        </th>
                        <th className="py-2.5 px-lg font-label-bold text-[12px] text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wide">
                          Phone
                        </th>
                        <th className="py-2.5 px-lg font-label-bold text-[12px] text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wide">
                          Date Applied
                        </th>
                        <th className="py-2.5 px-lg font-label-bold text-[12px] text-on-surface-variant dark:text-blue-200/60 uppercase tracking-wide text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-highest dark:divide-slate-700">
                      {PENDING.map(row => (
                        <tr
                          key={row.name}
                          className={`hover:bg-surface-container-low/50 dark:hover:bg-slate-700/30 transition-colors${
                            row.alt ? ' bg-surface/50 dark:bg-[#0d1729]/40' : ''
                          }`}
                        >
                          <td className="py-3 px-lg font-label-bold text-[13.5px] text-on-surface dark:text-blue-50">
                            {row.name}
                          </td>
                          <td className="py-3 px-lg text-on-surface-variant dark:text-blue-200/60 text-[13px]">
                            {row.phone}
                          </td>
                          <td className="py-3 px-lg text-on-surface-variant dark:text-blue-200/60 text-[13px]">
                            {row.date}
                          </td>
                          <td className="py-3 px-lg text-right space-x-2">
                            <button
                              type="button"
                              className="px-3 py-1 bg-[#dcfce7] dark:bg-[#14532d]/40 text-[#166534] dark:text-[#4ade80] rounded-lg font-label-bold text-[11px] hover:bg-[#bbf7d0] transition-colors border border-[#86efac] dark:border-[#166534]"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="px-3 py-1 bg-error-container dark:bg-error/20 text-on-error-container dark:text-[#ff897d] rounded-lg font-label-bold text-[11px] hover:bg-[#ffb4ab] transition-colors border border-[#ff897d] dark:border-error"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-surface-container-lowest dark:bg-[#0d1729] rounded-xl border border-outline-variant dark:border-[#1a2d4f] overflow-hidden">
                <div className="px-lg py-md border-b border-surface-container-highest dark:border-[#1a2d4f] flex justify-between items-center">
                  <h2 className="font-h3 text-h3 text-primary dark:text-primary-fixed-dim">
                    Member Overview
                  </h2>
                  <button
                    type="button"
                    className="text-primary dark:text-primary-fixed-dim font-label-bold text-label-bold hover:underline flex items-center gap-xs text-[13px]"
                  >
                    View Directory{' '}
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      arrow_forward
                    </span>
                  </button>
                </div>
                <div className="p-lg">
                  <div className="bg-surface-container-low dark:bg-[#111f36]/30 rounded-lg p-lg flex items-center justify-center border border-dashed border-outline-variant dark:border-[#1e3461] text-on-surface-variant dark:text-blue-200/60">
                    <p className="text-[13px]">Member Management Table Content goes here…</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-lg">
              <div className="bg-primary rounded-xl p-lg text-on-primary shadow-[0_4px_20px_rgba(0,31,80,0.2)]">
                <h3 className="font-h3 text-h3 mb-md">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-sm">
                  <button
                    type="button"
                    className="bg-primary-container/70 hover:bg-tertiary transition-colors p-md rounded-lg flex flex-col items-center justify-center gap-xs text-center group border border-white/10"
                  >
                    <span
                      className="material-symbols-outlined text-on-primary-container group-hover:text-white transition-colors"
                      style={{ fontSize: 20 }}
                    >
                      campaign
                    </span>
                    <span className="font-caption text-[11px] text-primary-fixed-dim group-hover:text-white transition-colors">
                      Announcement
                    </span>
                  </button>
                  <button
                    type="button"
                    className="bg-primary-container/70 hover:bg-tertiary transition-colors p-md rounded-lg flex flex-col items-center justify-center gap-xs text-center group border border-white/10"
                  >
                    <span
                      className="material-symbols-outlined text-on-primary-container group-hover:text-white transition-colors"
                      style={{ fontSize: 20 }}
                    >
                      download
                    </span>
                    <span className="font-caption text-[11px] text-primary-fixed-dim group-hover:text-white transition-colors">
                      Export Members
                    </span>
                  </button>
                  <button
                    type="button"
                    className="bg-primary-container/70 hover:bg-tertiary transition-colors p-md rounded-lg flex flex-col items-center justify-center gap-xs text-center group border border-white/10"
                  >
                    <span
                      className="material-symbols-outlined text-on-primary-container group-hover:text-white transition-colors"
                      style={{ fontSize: 20 }}
                    >
                      manage_accounts
                    </span>
                    <span className="font-caption text-[11px] text-primary-fixed-dim group-hover:text-white transition-colors">
                      Manage Roles
                    </span>
                  </button>
                  <button
                    type="button"
                    className="bg-secondary hover:bg-[#b85800] transition-colors p-md rounded-lg flex flex-col items-center justify-center gap-xs text-center group border border-secondary-container/30"
                  >
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>
                      how_to_reg
                    </span>
                    <span className="font-caption text-[11px] text-white">Approve Members</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
