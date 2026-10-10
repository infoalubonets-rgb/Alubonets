'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { activeNavGroup } from '@/lib/dashboard/active-nav'
import type { NavItem } from './DashboardShell'

export default function DashboardNav({
  nav,
  collapsed = false,
  onNavigate,
}: {
  nav: NavItem[]
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const currentGroup = activeNavGroup(pathname, nav)
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
      const top = (element.scrollTop / maxScroll) * travel
      setScrollbar((current) =>
        current.visible === visible &&
        Math.abs(current.height - height) < 0.5 &&
        Math.abs(current.top - top) < 0.5
          ? current
          : { visible, height, top },
      )
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
      <nav ref={scrollRef} className="dashboard-nav-scroll h-full overflow-y-auto py-1 px-sm space-y-0">
        {nav.map((link) => {
          const href = link.href || '#'
          const active = currentGroup === link
          const inSection = active
          const className = active || inSection
            ? `flex min-h-[34px] items-center gap-sm px-sm py-1.5 rounded-lg bg-secondary-container/20 text-on-primary font-label-bold text-[13.5px] ${collapsed ? 'justify-center' : ''}`
            : `sidebar-link ${collapsed ? 'justify-center' : ''}`

          return (
            <Link
              key={link.label}
              href={href}
              onClick={onNavigate}
              className={className}
              title={collapsed ? link.label : undefined}
              aria-current={active || inSection ? 'page' : undefined}
            >
              <span className={`relative material-symbols-outlined ${active || inSection ? 'text-[17px] text-secondary-container flex-shrink-0' : ''}`}>
                {link.icon}
                {collapsed && link.badge ? (
                  <span className="absolute -top-1 -right-2 bg-secondary text-white text-[9px] font-bold px-1 rounded-full leading-[13px] font-sans">
                    {link.badge}
                  </span>
                ) : null}
              </span>
              {!collapsed && <span className="min-w-0 flex-1 truncate">{link.label}</span>}
              {!collapsed && link.badge ? (
                <span className="bg-secondary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {link.badge}
                </span>
              ) : null}
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
