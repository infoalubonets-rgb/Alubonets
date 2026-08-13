import Link from 'next/link'
import { redirect } from 'next/navigation'
import InviteRegistrationClient from '@/components/auth/InviteRegistrationClient'
import { getFamilyInviteByToken } from '@/lib/family-invite'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>
}) {
  const { invite: token } = await searchParams
  if (!token) {
    redirect('/?register=1')
  }

  const invite = await getFamilyInviteByToken(token)
  if (!invite) {
    return (
      <main className="min-h-screen bg-primary px-4 py-16">
        <div className="mx-auto max-w-lg rounded-2xl bg-surface p-6 text-center">
          <h1 className="font-h2 text-2xl text-primary">Invite unavailable</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            This family invite is invalid or has expired. Ask your Principal Member to send a new
            invite.
          </p>
          <Link href="/login" className="mt-4 inline-block text-primary underline">
            Back to login
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-primary px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl bg-surface p-6">
        <InviteRegistrationClient
          invite={{
            token: invite.token,
            email: invite.email,
            fullName: invite.user.fullName,
            phone: invite.user.phone,
            principalName: invite.invitedBy.fullName,
            familyBranchHint: invite.user.memberProfile?.familyBranch || invite.invitedBy.fullName,
          }}
        />
      </div>
    </main>
  )
}
