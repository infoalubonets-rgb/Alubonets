'use client'

import { useEffect, useState } from 'react'

const AUTO_DISMISS_MS = 4000

export default function LoanSubmitFeedback({ submitted }: { submitted: boolean }) {
  const [visible, setVisible] = useState(submitted)

  useEffect(() => {
    if (!submitted) return

    // Keep the flash visible for this visit, but consume the query flag
    // immediately so refreshing the page cannot show it a second time.
    const url = new URL(window.location.href)
    url.searchParams.delete('submitted')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)

    const timeout = window.setTimeout(() => setVisible(false), AUTO_DISMISS_MS)
    return () => window.clearTimeout(timeout)
  }, [submitted])

  if (!visible) return null

  return (
    <p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 ring-1 ring-green-200">
      Loan application submitted successfully.
    </p>
  )
}
