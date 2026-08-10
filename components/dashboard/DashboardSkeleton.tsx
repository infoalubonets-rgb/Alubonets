'use client'

import { useEffect, useState } from 'react'

/**
 * Full-page skeleton that mimics the DashboardShell structure.
 * Used by loading.tsx files so users see a shaped placeholder
 * instead of a flash of unstyled content while server data loads.
 */
export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-on-surface/[0.08] dark:bg-white/[0.07] ${className ?? ''}`} />
  )
}

type ContentSkeletonProps = {
  /** Which content layout to render inside the main area */
  variant: 'overview-4stat' | 'overview-2stat' | 'list-form' | 'gallery'
}

export default function DashboardSkeleton({ variant }: ContentSkeletonProps) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 450)
    return () => window.clearTimeout(timer)
  }, [])
  if (!visible) return null

  return (
    <div className="h-screen flex overflow-hidden bg-background dark:bg-[#071426]">
      {/* Sidebar */}
      <aside className="w-56 bg-primary dark:bg-[#03112b] flex flex-col shrink-0 border-r border-white/[0.08]">
        {/* Logo area */}
        <div className="px-md pt-lg pb-md border-b border-white/10 flex items-center gap-sm">
          <div className="h-11 w-11 rounded-full bg-white/10 shrink-0 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-24 rounded bg-white/15 animate-pulse" />
            <div className="h-2.5 w-16 rounded bg-white/10 animate-pulse" />
          </div>
        </div>
        {/* Nav items */}
        <div className="flex-1 px-md py-md space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-sm px-sm py-[7px]">
              <div className="h-[17px] w-[17px] rounded bg-white/15 animate-pulse shrink-0" />
              <div className="h-3 rounded bg-white/10 animate-pulse" style={{ width: `${50 + i * 12}px` }} />
            </div>
          ))}
        </div>
        {/* Bottom links */}
        <div className="px-md py-md border-t border-white/10 space-y-sm">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 rounded bg-white/10 animate-pulse" style={{ width: `${60 + i * 10}px` }} />
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col h-screen min-h-0 min-w-0">
        {/* Header */}
        <header className="bg-surface-container-lowest dark:bg-[#091a30] border-b border-outline-variant dark:border-[#173056] shrink-0 flex items-center justify-between px-lg" style={{ height: 66 }}>
          <div className="flex items-center gap-md flex-1">
            <div className="h-5 w-5 rounded bg-on-surface/10 animate-pulse" />
            <div className="h-8 w-64 rounded-lg bg-on-surface/[0.06] animate-pulse" />
          </div>
          <div className="flex items-center gap-md">
            <div className="h-5 w-5 rounded bg-on-surface/10 animate-pulse" />
            <div className="h-5 w-5 rounded bg-on-surface/10 animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-on-surface/10 animate-pulse" />
            <div className="h-8 w-20 rounded-lg bg-on-surface/10 animate-pulse" />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 min-h-0 overflow-y-auto p-lg">
          {/* Page title */}
          <div className="flex items-center justify-between mb-5">
            <div className="space-y-2">
              <SkeletonBlock className="h-8 w-40" />
              <SkeletonBlock className="h-4 w-56" />
            </div>
            <SkeletonBlock className="h-7 w-28 rounded-full" />
          </div>

          <div className="max-w-4xl mx-auto space-y-5">
            <ContentSkeleton variant={variant} />
          </div>
        </main>
      </div>
    </div>
  )
}

function ContentSkeleton({ variant }: ContentSkeletonProps) {
  if (variant === 'overview-4stat') {
    return (
      <>
        {/* 4 stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            'bg-primary/40 dark:bg-[#0c1e42]',
            'bg-secondary-container/60 dark:bg-[#c45e00]/40',
            'bg-primary-container/40 dark:bg-[#153060]',
            'bg-secondary/40 dark:bg-[#7a3a00]/60',
          ].map((bg, i) => (
            <div key={i} className={`rounded-2xl ${bg} p-4 h-28 animate-pulse`} />
          ))}
        </div>
        {/* Spotlight banner */}
        <SkeletonBlock className="h-20 rounded-2xl" />
        {/* 3 quick links */}
        <div className="grid sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-16 rounded-2xl" />)}
        </div>
        {/* Section */}
        <SkeletonBlock className="h-40 rounded-2xl" />
      </>
    )
  }

  if (variant === 'overview-2stat') {
    return (
      <>
        {/* 2 stat cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-primary/40 dark:bg-[#0c1e42] p-4 h-32 animate-pulse" />
          <div className="rounded-2xl bg-secondary-container/60 dark:bg-[#c45e00]/40 p-4 h-32 animate-pulse" />
        </div>
        {/* CTA button */}
        <div className="flex justify-end">
          <SkeletonBlock className="h-10 w-40 rounded-xl" />
        </div>
        {/* 2 quick links */}
        <div className="grid sm:grid-cols-2 gap-3">
          {[1, 2].map((i) => <SkeletonBlock key={i} className="h-16 rounded-2xl" />)}
        </div>
        {/* 2-col sections */}
        <div className="grid md:grid-cols-2 gap-4">
          <SkeletonBlock className="h-48 rounded-2xl" />
          <SkeletonBlock className="h-48 rounded-2xl" />
        </div>
        <SkeletonBlock className="h-32 rounded-2xl" />
      </>
    )
  }

  if (variant === 'list-form') {
    return (
      <>
        {/* Form card */}
        <SkeletonBlock className="h-52 rounded-2xl" />
        {/* List sections */}
        <SkeletonBlock className="h-64 rounded-2xl" />
        <SkeletonBlock className="h-40 rounded-2xl" />
      </>
    )
  }

  if (variant === 'gallery') {
    return (
      <>
        {/* Upload form */}
        <SkeletonBlock className="h-52 rounded-2xl" />
        {/* Photo grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonBlock key={i} className="h-48 rounded-2xl" />)}
        </div>
      </>
    )
  }

  return null
}
