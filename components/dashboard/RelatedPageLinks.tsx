'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

type LinkItem = { icon: string; label: string; href?: string; badge?: string | number | null }

const BASE =
  'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-label-bold transition active:scale-[0.98]'
const IDLE =
  'border-primary/30 bg-primary text-on-primary shadow-[0_3px_10px_rgba(0,31,80,0.18)] hover:border-secondary-container/50 hover:bg-secondary-container dark:border-primary-container/40 dark:bg-primary-container dark:hover:bg-secondary-container'
const CURRENT =
  'border-[#fe8015] bg-secondary-fixed text-on-secondary-fixed shadow-[0_3px_10px_rgba(254,128,21,0.25)]'

/** Detail pages that belong to a link whose path is not their parent. */
const SECTION_OF: { prefix: string; href: string }[] = []

/**
 * The link for the page you are on: its path matches (exactly or as a parent) and every query
 * value it names matches the URL, preferring the longest path and then the most specific query.
 */
function currentHref(items: LinkItem[], pathname: string, search: URLSearchParams | null) {
  const section = SECTION_OF.find((entry) => pathname.startsWith(entry.prefix))
  if (section && items.some((item) => item.href === section.href)) return section.href
  let best: { href: string; pathLength: number; queryCount: number } | null = null
  for (const item of items) {
    if (!item.href) continue
    const [path, query = ''] = item.href.split('?')
    if (pathname !== path && !pathname.startsWith(`${path}/`)) continue
    const params = [...new URLSearchParams(query)]
    if (!params.every(([key, value]) => search?.get(key) === value)) continue
    const candidate = { href: item.href, pathLength: path.length, queryCount: params.length }
    if (
      !best ||
      candidate.pathLength > best.pathLength ||
      (candidate.pathLength === best.pathLength && candidate.queryCount > best.queryCount)
    ) {
      best = candidate
    }
  }
  return best?.href
}

function Links({ items, search, activeAmong }: { items: LinkItem[]; search: URLSearchParams | null; activeAmong?: LinkItem[] }) {
  const pathname = usePathname()
  // The pill you clicked lights up straight away, even while the next page is still loading,
  // so the old page's pill never looks selected after you have chosen another one.
  const [clicked, setClicked] = useState<string | null>(null)
  const location = `${pathname}?${search?.toString() ?? ''}`
  useEffect(() => setClicked(null), [location])
  // When pills are split across rows, the current page is still chosen from the whole set.
  const active = clicked ?? currentHref(activeAmong ?? items, pathname, search)
  return (
    <>
      {items.map((item) => {
        const href = item.href!
        const isCurrent = href === active
        return (
          <Link
            key={href}
            href={href}
            onClick={(event) => {
              if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) setClicked(href)
            }}
            aria-current={isCurrent ? 'page' : undefined}
            className={`${BASE} ${isCurrent ? CURRENT : IDLE}`}
          >
            <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
            {item.label}
            {item.badge && <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] leading-none text-white">{item.badge}</span>}
          </Link>
        )
      })}
    </>
  )
}

function LinksWithQuery({ items, activeAmong }: { items: LinkItem[]; activeAmong?: LinkItem[] }) {
  const search = useSearchParams()
  return <Links items={items} search={search} activeAmong={activeAmong} />
}

/** Header buttons for the sibling pages of the current section; the page you are on is light orange. */
export default function RelatedPageLinks({ items, activeAmong }: { items: LinkItem[]; activeAmong?: LinkItem[] }) {
  return (
    <Suspense fallback={<Links items={items} search={null} activeAmong={activeAmong} />}>
      <LinksWithQuery items={items} activeAmong={activeAmong} />
    </Suspense>
  )
}
