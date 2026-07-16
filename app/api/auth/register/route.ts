import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createServerClient as createServiceClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { syncAppMetadata } from '@/lib/auth/session'
import { toAuthUser } from '@/lib/auth/helpers'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Provide a valid name, email, and password (min 8 characters).' },
        { status: 400 }
      )
    }

    const { email, password, fullName, phone } = parsed.data
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing?.status === 'ACTIVE' && existing.authUserId) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please log in.' },
        { status: 409 }
      )
    }

    const admin = createServiceClient()
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role: 'MEMBER', status: 'PENDING' },
    })

    if (error || !created.user) {
      return NextResponse.json(
        { error: error?.message || 'Could not create account.' },
        { status: 400 }
      )
    }

    const profile = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            authUserId: created.user.id,
            fullName,
            phone: phone || existing.phone,
            role: 'MEMBER',
            status: 'PENDING',
          },
        })
      : await prisma.user.create({
          data: {
            authUserId: created.user.id,
            email,
            fullName,
            phone,
            role: 'MEMBER',
            status: 'PENDING',
          },
        })

    await syncAppMetadata(created.user.id, 'MEMBER', 'PENDING')

    // Optional: sign them in so they land on /pending
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    await supabase.auth.signInWithPassword({ email, password })

    return NextResponse.json({
      user: toAuthUser(profile),
      redirectTo: '/pending',
      status: 'PENDING',
    })
  } catch (err) {
    console.error('register error', err)
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 })
  }
}
