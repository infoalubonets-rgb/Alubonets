'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import ScrollToolbar from '@/components/ui/ScrollToolbar'

export type HeaderUnit = { key: string; node: ReactNode }

const GAP = 8 // matches gap-2
const DESKTOP = '(min-width: 1024px)'

/**
 * Page header buttons. On desktop they fill the title row up to its end; whatever does not fit
 * moves to a second row that scrolls sideways (arrows below it). Pages with few buttons keep
 * a single row. On smaller screens every button sits in one scrolling row under the title.
 */
export default function HeaderOverflow({ title, units }: { title: ReactNode; units: HeaderUnit[] }) {
  const [desktop, setDesktop] = useState(false)
  const [split, setSplit] = useState(units.length)
  const firstRow = useRef<HTMLDivElement>(null)
  const widths = useRef(new Map<string, number>())
  const nodes = useRef(new Map<string, HTMLDivElement>())
  const unitKeys = units.map((u) => u.key).join('|')

  useEffect(() => {
    const query = window.matchMedia(DESKTOP)
    const update = () => setDesktop(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // A new set of buttons starts back in the first row so each can be measured.
  useEffect(() => {
    widths.current.clear()
    setSplit(units.length)
  }, [unitKeys, units.length])

  const fit = useCallback(() => {
    const row = firstRow.current
    if (!row) return
    for (const [key, el] of nodes.current) if (el.offsetWidth) widths.current.set(key, el.offsetWidth)
    const available = row.clientWidth
    let used = 0
    let count = 0
    for (const unit of units) {
      const width = widths.current.get(unit.key)
      if (width == null) return // not measured yet
      const next = used + (count ? GAP : 0) + width
      if (next > available) break
      used = next
      count += 1
    }
    setSplit((current) => (current === count ? current : count))
  }, [units])

  useLayoutEffect(() => {
    if (desktop) fit()
  }, [desktop, fit, split])

  useEffect(() => {
    const row = firstRow.current
    if (!desktop || !row) return
    const observer = new ResizeObserver(() => fit())
    observer.observe(row)
    return () => observer.disconnect()
  }, [desktop, fit])

  const keep = (key: string) => (el: HTMLDivElement | null) => {
    if (el) nodes.current.set(key, el)
    else nodes.current.delete(key)
  }

  if (!desktop) {
    return (
      <>
        <div className="min-w-0">{title}</div>
        {units.length > 0 && (
          <ScrollToolbar label="Page actions">
            {units.map((unit) => <div key={unit.key} className="flex shrink-0 items-center gap-2">{unit.node}</div>)}
          </ScrollToolbar>
        )}
      </>
    )
  }

  const inFirst = units.slice(0, split)
  const overflow = units.slice(split)
  return (
    <>
      <div className="flex min-w-0 items-center gap-4">
        <div className="shrink-0">{title}</div>
        {/* Fills to the end of the row; overflow is measured, never wrapped. */}
        <div ref={firstRow} className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden">
          {inFirst.map((unit) => (
            <div key={unit.key} ref={keep(unit.key)} className="flex shrink-0 items-center gap-2 [&_.flex-wrap]:!flex-nowrap">{unit.node}</div>
          ))}
        </div>
      </div>
      {overflow.length > 0 && (
        <ScrollToolbar label="More page actions">
          {overflow.map((unit) => (
            <div key={unit.key} ref={keep(unit.key)} className="flex shrink-0 items-center gap-2">{unit.node}</div>
          ))}
        </ScrollToolbar>
      )}
    </>
  )
}
