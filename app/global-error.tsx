'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#071426', color: '#eef4ff', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, boxSizing: 'border-box' }}>
          <section style={{ width: '100%', maxWidth: 440, padding: 32, boxSizing: 'border-box', borderRadius: 24, textAlign: 'center', background: '#0d1d33', border: '1px solid #294365', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ width: 56, height: 56, margin: '0 auto', display: 'grid', placeItems: 'center', borderRadius: 16, background: 'rgba(254,128,21,.14)', color: '#fe8015', fontSize: 26 }}>!</div>
            <h1 style={{ margin: '18px 0 8px', fontSize: 22 }}>Alubonets is temporarily unavailable</h1>
            <p style={{ margin: 0, color: '#b7c7df', lineHeight: 1.6, fontSize: 14 }}>We could not complete that request. Your information is safe. Please check your connection and try again.</p>
            {error.digest && <p style={{ color: '#7890ae', fontSize: 10 }}>Reference: {error.digest}</p>}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
              <button onClick={reset} style={{ border: 0, borderRadius: 999, padding: '11px 20px', background: '#fe8015', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Try again</button>
              <a href="/" style={{ borderRadius: 999, padding: '10px 20px', border: '1px solid #7890ae', color: '#eef4ff', textDecoration: 'none' }}>Return home</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
