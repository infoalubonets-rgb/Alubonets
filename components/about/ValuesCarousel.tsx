'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const VALUES = [
  {
    icon: 'handshake',
    title: 'Unity & Identity',
    body: 'Strengthening family bonds across generations.',
  },
  {
    icon: 'account_balance',
    title: 'Governance & Accountability',
    body: 'Promoting transparent leadership and responsible management.',
  },
  {
    icon: 'devices',
    title: 'Digital Transformation',
    body: 'Embracing modern systems that improve communication and record keeping.',
  },
  {
    icon: 'volunteer_activism',
    title: 'Welfare Support',
    body: 'Supporting members during important life events and times of need.',
  },
  {
    icon: 'trending_up',
    title: 'Economic Empowerment',
    body: 'Creating opportunities for financial growth and development.',
  },
  {
    icon: 'balance',
    title: 'Inclusivity & Conflict Resolution',
    body: 'Encouraging participation, respect and peaceful coexistence.',
  },
]

const GAP = 24

export default function ValuesCarousel() {
  const trackRef = useRef<HTMLDivElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const [cur, setCur] = useState(0)
  const [cols, setCols] = useState(1)
  const [cardWidth, setCardWidth] = useState(0)

  const maxStep = Math.max(0, VALUES.length - cols)

  const measure = useCallback(() => {
    if (typeof window === 'undefined') return
    const c = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1
    const cw = parentRef.current?.offsetWidth ?? 0
    const w = c > 0 && cw > 0 ? (cw - GAP * (c - 1)) / c : 0
    setCols(c)
    setCardWidth(w)
    setCur(prev => Math.min(prev, Math.max(0, VALUES.length - c)))
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const go = (idx: number) => {
    setCur(Math.max(0, Math.min(idx, maxStep)))
  }

  return (
    <div className="relative px-10 md:px-12">
      <button
        type="button"
        aria-label="Previous"
        onClick={() => go(cur - 1)}
        style={{ opacity: cur === 0 ? 0.35 : 1 }}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 border border-white/20 flex items-center justify-center transition-all active:scale-95"
      >
        <span className="material-symbols-outlined text-white text-[22px]">chevron_left</span>
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => go(cur + 1)}
        style={{ opacity: cur === maxStep ? 0.35 : 1 }}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 border border-white/20 flex items-center justify-center transition-all active:scale-95"
      >
        <span className="material-symbols-outlined text-white text-[22px]">chevron_right</span>
      </button>

      <div className="overflow-hidden" ref={parentRef}>
        <div
          ref={trackRef}
          className="flex gap-lg"
          style={{
            transition: 'transform .75s cubic-bezier(.4,0,.2,1)',
            transform: `translateX(-${cur * (cardWidth + GAP)}px)`,
          }}
        >
          {VALUES.map(v => (
            <article
              key={v.title}
              className="value-card group relative bg-surface-container-lowest rounded-xl p-lg border border-white/10 overflow-hidden flex-shrink-0"
              style={{ width: cardWidth || undefined }}
            >
              <div className="value-bar absolute top-0 left-0 right-0 h-1 bg-secondary-container" />
              <div className="value-icon bg-primary-fixed w-12 h-12 rounded-xl flex items-center justify-center mb-md text-primary">
                <span className="material-symbols-outlined">{v.icon}</span>
              </div>
              <h3 className="font-h3 text-[20px] leading-snug text-primary mb-xs">{v.title}</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">{v.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-sm mt-lg">
        {Array.from({ length: maxStep + 1 }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => go(i)}
            className="rounded-full"
            style={{
              height: 8,
              border: 'none',
              cursor: 'pointer',
              transition: 'all .4s ease',
              background: i === cur ? '#fe8015' : 'rgba(255,255,255,0.3)',
              width: i === cur ? 24 : 8,
            }}
          />
        ))}
      </div>
    </div>
  )
}
