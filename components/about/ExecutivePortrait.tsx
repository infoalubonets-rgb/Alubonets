'use client'

import { useState } from 'react'

export default function ExecutivePortrait({ src, alt }: { src: string | null; alt: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const frame = 'mb-sm h-28 w-28 shrink-0 rounded-full border border-primary/15'
  if (src && src !== failedSrc) {
    return <img src={src} alt={alt} className={`${frame} object-cover`} onError={() => setFailedSrc(src)} />
  }
  return <div role="img" aria-label={`${alt} — no profile photo`} className={`${frame} flex items-center justify-center bg-primary`}>
    <svg viewBox="0 0 100 100" className="h-24 w-24 text-secondary-container" aria-hidden="true">
      <circle cx="50" cy="34" r="17" fill="currentColor" />
      <path d="M17 88v-9c0-18 15-29 33-29s33 11 33 29v9Z" fill="currentColor" />
    </svg>
  </div>
}
