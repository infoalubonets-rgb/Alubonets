'use client'

import { useRouter } from 'next/navigation'
import RegistrationWizard from '@/components/auth/RegistrationWizard'

export default function InviteRegistrationClient({
  invite,
}: {
  invite: {
    token: string
    email: string
    fullName: string
    phone?: string | null
    principalName: string
    familyBranchHint?: string
  }
}) {
  const router = useRouter()
  return (
    <RegistrationWizard
      invite={invite}
      onComplete={() => {
        router.push('/pending')
        router.refresh()
      }}
      onSignIn={() => router.push('/login')}
    />
  )
}
