import Link from 'next/link'
import type { Metadata } from 'next'
import { ADMIN_LOGIN_LOGO } from '@/lib/constants'
import { findSetupInvite } from '@/app/actions/account-setup'
import AccountSetupForm from '@/components/auth/AccountSetupForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Set up your account' }

/** Landing page for the link an administrator sends when they create a member's account. */
export default async function AccountSetupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams
  const invite = await findSetupInvite(token)
  return (
    <main className="min-h-screen bg-primary px-4 py-16">
      <div className="mx-auto max-w-md">
        <div className="relative z-10 mx-auto -mb-7 w-fit rounded-2xl border border-outline-variant/30 bg-surface px-4 py-2 shadow-xl">
          <img src={ADMIN_LOGIN_LOGO} alt="Alubonets SHG" className="h-12 w-auto" />
        </div>
        <div className="space-y-4 rounded-2xl bg-surface px-6 pb-6 pt-14 shadow-2xl">
          {invite?.user ? (
            <>
              <div>
                <h1 className="font-h3 text-xl text-primary">Welcome, {invite.user.fullName.split(' ')[0]}</h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  An administrator created your Alubonets account for <b>{invite.user.email}</b>. Choose your own password to finish.
                </p>
              </div>
              <AccountSetupForm token={token} />
            </>
          ) : (
            <>
              <h1 className="font-h3 text-xl text-primary">This link can’t be used</h1>
              <p className="text-sm text-on-surface-variant">
                It has expired, was already used, or was replaced by a newer link. Ask an administrator for a new one, or sign in if you already set your password.
              </p>
              <Link href="/login" className="block w-full rounded-full bg-secondary-container py-3 text-center font-semibold text-on-secondary">Go to login</Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
