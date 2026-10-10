'use client'

import { useState } from 'react'
import FullScreenModal from '@/components/ui/FullScreenModal'

export default function RecentLoginsButton({ logins }: { logins: { id: string; email: string; at: string }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary shadow-[0_3px_10px_rgba(0,31,80,0.18)] transition hover:opacity-90 active:scale-[0.98]"
      >
        <span className="material-symbols-outlined text-[18px]">login</span>
        Recent logins
      </button>
      <FullScreenModal open={open} title="Recent logins" onClose={() => setOpen(false)} size="compact">
        {logins.length === 0 ? (
          <p className="py-6 text-center text-sm text-on-surface-variant">No logins yet.</p>
        ) : (
          <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant text-sm">
            {logins.map((login) => (
              <li key={login.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0 truncate font-medium text-on-surface">{login.email}</span>
                <span className="whitespace-nowrap text-on-surface-variant">
                  {new Date(login.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </FullScreenModal>
    </>
  )
}
