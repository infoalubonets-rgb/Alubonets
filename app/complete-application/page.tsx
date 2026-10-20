import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import CompleteApplicationClient from '@/components/auth/CompleteApplicationClient'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Complete your application', robots: { index: false, follow: false } }

/** Where a first-time Google sign-in lands: the full membership application, minus the password. */
export default async function CompleteApplicationPage() {
  const supabase = createClient(await cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')
  const profile = await prisma.user.findFirst({ where: { authUserId: user.id }, select: { fullName: true } })

  return (
    <main className="min-h-screen bg-primary px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl bg-surface p-6 shadow-xl">
        <CompleteApplicationClient account={{ email: user.email, fullName: profile?.fullName ?? '' }} />
      </div>
    </main>
  )
}
