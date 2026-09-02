'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const AUTO_DISMISS_MS = 4000

export default function WelfareSubmitFeedback({ submitted, error }: { submitted: boolean; error: boolean }) {
  const router = useRouter()
  const [visible, setVisible] = useState(submitted || error)

  useEffect(() => {
    if (!submitted && !error) return
    setVisible(true)
    const timeout = setTimeout(() => {
      setVisible(false)
      router.replace('/dashboard/member/welfare', { scroll: false })
    }, AUTO_DISMISS_MS)
    return () => clearTimeout(timeout)
  }, [submitted, error, router])

  if (!visible) return null

  return submitted ? (
    <p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 ring-1 ring-green-200">
      Submitted successfully.
    </p>
  ) : (
    <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200">
      Enter a description and an amount within the allowed Welfare limits.
    </p>
  )
}
