'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

function friendlyMessage(error: Error) {
  const message = error.message.toLowerCase()
  if (message.includes('unauthorized') || message.includes('session') || message.includes('jwt')) {
    return {
      icon: 'lock_clock',
      title: 'Your session needs to be refreshed',
      detail: 'Please sign in again to continue securely.',
      auth: true,
    }
  }
  if (message.includes('connect') || message.includes('database') || message.includes('prisma') || message.includes('network') || message.includes('fetch')) {
    return {
      icon: 'cloud_off',
      title: 'We could not connect right now',
      detail: 'The service may be temporarily unavailable. Check your connection and try again.',
      auth: false,
    }
  }
  return {
    icon: 'warning',
    title: 'Something did not load correctly',
    detail: 'Your information is safe. Please try again, or return to your dashboard.',
    auth: false,
  }
}

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  const copy = friendlyMessage(error)

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-6">
      <section className="w-full max-w-md rounded-[24px] border border-outline-variant/60 bg-surface p-7 text-center shadow-[0_18px_50px_rgba(0,31,80,0.12)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-container/10 text-secondary">
          <span className="material-symbols-outlined text-[28px]">{copy.icon}</span>
        </div>
        <h1 className="mt-4 font-h3 text-xl text-primary">{copy.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{copy.detail}</p>
        {error.digest && <p className="mt-2 text-[10px] text-outline">Reference: {error.digest}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {copy.auth ? (
            <a href="/login" className="rounded-full bg-secondary-container px-5 py-2.5 text-sm font-label-bold text-on-primary">Sign in again</a>
          ) : (
            <button type="button" onClick={reset} className="rounded-full bg-secondary-container px-5 py-2.5 text-sm font-label-bold text-on-primary">Try again</button>
          )}
          <a href="/" className="rounded-full border border-primary/40 px-5 py-2.5 text-sm font-label-bold text-primary">Return home</a>
        </div>
      </section>
    </main>
  )
}
