'use client'

import RegistrationWizard from '@/components/auth/RegistrationWizard'
import { logoutRequest } from '@/lib/auth/client'

export default function CompleteApplicationClient({ account }: { account: { email: string; fullName: string } }) {
  return (
    <RegistrationWizard
      account={account}
      onComplete={() => window.location.assign('/pending')}
      onSignIn={() => {
        logoutRequest().finally(() => window.location.assign('/'))
      }}
    />
  )
}
