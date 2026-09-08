'use client'

import { getTestAccounts, type DevAccount } from '@/lib/dev-test-accounts'

export type { DevAccount }
export const TEST_ACCOUNTS = getTestAccounts()

export default function DevAccountsDropdown({
  open,
  onPick,
}: {
  open: boolean
  onPick: (email: string, password: string) => void
}) {
  if (process.env.NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS === 'false' || !open) return null

  const accounts = getTestAccounts()
  if (accounts.length === 0) {
    return (
      <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-outline-variant bg-white shadow-lg p-3 text-[12px] text-error">
        Set <code>NEXT_PUBLIC_SEED_AUTH_PASSWORD</code> and{' '}
        <code>NEXT_PUBLIC_SUPER_ADMIN_PASSWORD</code> in <code>.env.local</code>, then restart{' '}
        <code>npm run dev</code>.
      </div>
    )
  }

  return (
    <div
      className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-outline-variant bg-white shadow-lg overflow-hidden"
      onMouseDown={(e) => e.preventDefault()}
    >
      <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-on-surface-variant bg-surface-container-low border-b border-outline-variant/60">
        Test accounts — click to autofill email + password
      </p>
      <ul className="max-h-56 overflow-y-auto">
        {accounts.map((a) => (
          <li key={a.email}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onPick(a.email, a.password)
              }}
              className="w-full text-left px-3 py-2 hover:bg-surface-container transition-colors"
            >
              <span className="block text-[13px] font-medium text-on-surface">{a.email}</span>
              <span className="block text-[11px] text-on-surface-variant">{a.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
