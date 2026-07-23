export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { ROLE_HOME } from '@/lib/auth/types'
import { syncUserMetadata } from '@/lib/auth/session'
import { toAuthUser } from '@/lib/auth/helpers'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })

    if (error || !data.user) {
      const message = error?.message?.toLowerCase() ?? ''
      if (message.includes('email not confirmed')) {
        return NextResponse.json(
          {
            error:
              'Your email address has not been verified yet. Please check your inbox for the verification link.',
          },
          { status: 401 }
        )
      }
      const knownProfile = await prisma.user.findUnique({
        where: { email: parsed.data.email },
        select: { id: true },
      })
      if (!knownProfile) {
        return NextResponse.json(
          {
            error:
              'We could not find an account with this email address. Please check the spelling or create an account first.',
          },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: 'Incorrect password. Please try again.' },
        { status: 401 }
      )
    }

    let profile = await prisma.user.findFirst({
      where: {
        OR: [{ authUserId: data.user.id }, { email: parsed.data.email }],
      },
    })

    if (!profile) {
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'No member profile found. Please register first.' },
        { status: 403 }
      )
    }

    if (!profile.authUserId) {
      profile = await prisma.user.update({
        where: { id: profile.id },
        data: { authUserId: data.user.id },
      })
    }

    await syncUserMetadata(profile)

    if (profile.status === 'PENDING') {
      return NextResponse.json({
        user: toAuthUser(profile),
        redirectTo: '/pending',
        status: 'PENDING',
      })
    }

    if (profile.status === 'SUSPENDED') {
      await supabase.auth.signOut()
      return NextResponse.json(
        {
          error:
            'Your account has been temporarily suspended. Please contact the group administrator.',
        },
        { status: 403 }
      )
    }

    if (profile.status !== 'ACTIVE') {
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'Your account is not active. Please contact the group administrator.' },
        { status: 403 }
      )
    }

    const user = toAuthUser(profile)
    return NextResponse.json({
      user: {
        ...user,
        isSuperAdmin: profile.isSuperAdmin,
        dashboardAccess: profile.dashboardAccess,
      },
      redirectTo: ROLE_HOME[user.role],
      status: profile.status,
    })
  } catch (err) {
    console.error('login error', err)
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 })
  }
}
