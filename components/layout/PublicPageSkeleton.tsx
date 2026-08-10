'use client'

import { useEffect, useState, type CSSProperties } from 'react'

function Pulse({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={`animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700/50 ${className ?? ''}`} style={style} />
}

type Props = {
  /** How many content block rows to render below the hero */
  rows?: number
  /** Show a grid of cards instead of stacked rows */
  grid?: boolean
}

export default function PublicPageSkeleton({ rows = 3, grid = false }: Props) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 450)
    return () => window.clearTimeout(timer)
  }, [])
  if (!visible) return null

  return (
    <div className="min-h-screen bg-background dark:bg-[#060c1a]">
      {/* Navbar skeleton */}
      <div className="sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#060c1a] px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Pulse className="h-9 w-9 rounded-full" />
          <Pulse className="h-4 w-28" />
        </div>
        <div className="hidden md:flex items-center gap-6">
          {[80, 60, 72, 56].map((w, i) => (
            <Pulse key={i} className="h-3.5" style={{ width: w }} />
          ))}
        </div>
        <Pulse className="h-9 w-24 rounded-full" />
      </div>

      {/* Hero skeleton */}
      <div className="px-6 py-20 max-w-5xl mx-auto flex flex-col items-center gap-5">
        <Pulse className="h-4 w-28 rounded-full" />
        <Pulse className="h-10 w-3/4 max-w-xl" />
        <Pulse className="h-10 w-1/2 max-w-sm" />
        <Pulse className="h-5 w-full max-w-lg mt-1" />
        <Pulse className="h-5 w-2/3 max-w-md" />
        <div className="flex gap-3 mt-2">
          <Pulse className="h-11 w-32 rounded-full" />
          <Pulse className="h-11 w-32 rounded-full" />
        </div>
      </div>

      {/* Content area */}
      <div className="px-6 pb-20 max-w-5xl mx-auto">
        {grid ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: rows * 3 }).map((_, i) => (
              <Pulse key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Pulse className="h-6 w-48" />
                <Pulse className="h-4 w-full" />
                <Pulse className="h-4 w-5/6" />
                <Pulse className="h-4 w-4/6" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
