'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export default function ScrollToolbar({ children, enabled = true, label = 'Page actions' }: { children: ReactNode; enabled?: boolean; label?: string }) {
  const viewport = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  useEffect(() => {
    const el = viewport.current
    if (!enabled || !el) return
    const measure = () => setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    el.addEventListener('scroll', measure, { passive: true })
    return () => { observer.disconnect(); el.removeEventListener('scroll', measure) }
  }, [enabled, children])
  if (!enabled) return <>{children}</>
  const move = (direction: number) => viewport.current?.scrollBy({ left: direction * Math.max(200, viewport.current.clientWidth * 0.7), behavior: 'smooth' })
  return <div className="min-w-0 w-full" role="group" aria-label={label}>
    <div ref={viewport} className="min-w-0 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max min-w-full items-center gap-2 [&_.flex-wrap]:!flex-nowrap [&_a]:shrink-0 [&_a]:whitespace-nowrap [&_button]:shrink-0">{children}</div>
    </div>
    {(edges.left || edges.right) && <div className="flex justify-end gap-1 pb-1">
      <button type="button" aria-label={`Scroll ${label} left`} disabled={!edges.left} onClick={() => move(-1)} className="grid h-6 w-6 place-items-center rounded text-primary hover:bg-primary/10 disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
      <button type="button" aria-label={`Scroll ${label} right`} disabled={!edges.right} onClick={() => move(1)} className="grid h-6 w-6 place-items-center rounded text-primary hover:bg-primary/10 disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
    </div>}
  </div>
}
