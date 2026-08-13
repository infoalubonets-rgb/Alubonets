'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { NavItem } from './DashboardShell'

function isNavActive(pathname: string, href: string, allHrefs: string[]) {
  if (!href || href === '#') return false
  const matches = allHrefs.filter(
    (h) => h && h !== '#' && (pathname === h || pathname.startsWith(`${h}/`))
  )
  if (matches.length === 0) return false
  const best = matches.reduce((a, b) => (a.length >= b.length ? a : b))
  return best === href
}

export default function DashboardNav({
  nav,
  collapsed = false,
}: {
  nav: NavItem[]
  collapsed?: boolean
}) {
  const pathname = usePathname()
  const hrefs = nav.map((n) => n.href || '#')
  const scrollRef = useRef<HTMLElement>(null)
  const [scrollbar, setScrollbar] = useState({ visible: false, top: 0, height: 0 })

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const update = () => {
      const visible = element.scrollHeight > element.clientHeight + 1
      const height = visible ? Math.max(20, (element.clientHeight / element.scrollHeight) * element.clientHeight) : 0
      const travel = Math.max(0, element.clientHeight - height)
      const maxScroll = Math.max(1, element.scrollHeight - element.clientHeight)
      setScrollbar({ visible, height, top: (element.scrollTop / maxScroll) * travel })
    }
    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => {
      element.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [nav.length, collapsed])

  return (
    <div className="relative min-h-0 flex-1">
    <nav ref={scrollRef} className="dashboard-nav-scroll h-full overflow-y-auto py-sm px-sm space-y-0.5">
      {nav.map((link) => {
        const href = link.href || '#'
        const active = isNavActive(pathname, href, hrefs)
        const className = active
          ? `flex items-center gap-sm px-sm py-[7px] rounded-lg bg-secondary-container/20 text-on-primary font-label-bold text-[13.5px] ${collapsed ? 'justify-center' : ''}`
          : `sidebar-link ${collapsed ? 'justify-center' : ''}`

        return (
          <Link
            key={link.label}
            href={href}
            className={className}
            title={collapsed ? link.label : undefined}
          >
            <span
              className={`relative material-symbols-outlined ${active ? 'text-[17px] text-secondary-container flex-shrink-0' : ''}`}
            >
              {link.icon}
              {collapsed && link.badge ? (
                <span className="absolute -top-1 -right-2 bg-secondary text-white text-[9px] font-bold px-1 rounded-full leading-[13px] font-sans">
                  {link.badge}
                </span>
              ) : null}
            </span>
            {collapsed ? null : link.badge ? (
              <>
                <span className="flex-1">{link.label}</span>
                <span className="bg-secondary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {link.badge}
                </span>
              </>
            ) : (
              link.label
            )}
          </Link>
        )
      })}
    </nav>
    {scrollbar.visible && (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-px top-0 w-px rounded-full bg-[#ffc400]"
        style={{ height: scrollbar.height, transform: `translateY(${scrollbar.top}px)` }}
      />
    )}
    </div>
  )
}
