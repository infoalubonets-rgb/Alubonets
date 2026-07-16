'use client'

import { useState } from 'react'
import { logoutRequest } from '@/lib/auth/client'

export default function PendingPage() {
  const [loading, setLoading] = useState(false)

  const onLogout = async () => {
    setLoading(true)
    await logoutRequest()
    window.location.href = '/login'
  }

  return (
    <main className="min-h-screen bg-primary flex items-center justify-center px-md">
      <div className="bg-surface rounded-2xl p-lg max-w-md w-full shadow-xl text-center">
        <h1 className="font-h3 text-h3 text-secondary-container mb-sm">Awaiting approval</h1>
        <p className="text-on-surface-variant mb-lg">
          Your registration was received. An administrator will review your membership before you
          can access the dashboards.
        </p>
        <button
          type="button"
          onClick={onLogout}
          disabled={loading}
          className="inline-block rounded-lg bg-primary text-on-primary px-md py-sm disabled:opacity-60"
        >
          {loading ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </main>
  )
}
