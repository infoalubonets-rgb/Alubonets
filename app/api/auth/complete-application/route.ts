import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { syncUserMetadata } from '@/lib/auth/session'
import { POLICY_VERSION, applicationSchema, requestIp } from '@/lib/membership'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/logger'
import { publicErrorMessage } from '@/lib/safe-error'

/**
 * Membership application for someone who is already signed in but never applied — usually a
 * first-time "Continue with Google". Same fields and consent as the registration wizard, minus
 * email (taken from the session) and password (Google handles sign-in). The account stays
 * PENDING until an administrator approves it.
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Your session has ended. Please sign in again.' }, { status: 401 })

    const parsed = applicationSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Complete every required field.' },
        { status: 400 },
      )
    }
    const data = parsed.data
    const ipAddress = requestIp(req)
    await enforceRateLimit(`complete-application:${authUser.id}`, 5, 30)

    const existing = await prisma.user.findFirst({
      where: { authUserId: authUser.id },
      select: { id: true, status: true, _count: { select: { consentRecords: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'We could not find your account. Please sign in again.' }, { status: 404 })
    if (existing.status !== 'PENDING' || existing._count.consentRecords > 0) {
      return NextResponse.json({ error: 'Your application was already submitted.' }, { status: 409 })
    }

    const details = {
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
      address: data.location,
      familyBranch: data.familyBranch,
      nextOfKinName: data.nextOfKinName,
      nextOfKinPhone: data.nextOfKinPhone,
      nextOfKinRelationship: data.nextOfKinRelationship,
      profession: data.profession,
      skills: data.skills,
      educationLevel: data.educationLevel,
      achievements: data.achievements,
      mentorshipArea: data.mentorshipArea,
      interests: data.interests,
      emergencyContactName: data.emergencyContactName,
      emergencyContactPhone: data.emergencyContactPhone,
      memberCategory: data.memberCategory,
    }
    const [profile] = await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.id },
        data: { fullName: data.fullName, phone: data.phone, location: data.location },
      }),
      prisma.memberProfile.upsert({
        where: { userId: existing.id },
        create: { userId: existing.id, ...details },
        update: details,
      }),
      prisma.consentRecord.create({
        data: {
          userId: existing.id,
          termsVersion: POLICY_VERSION,
          privacyVersion: POLICY_VERSION,
          ipAddress,
          userAgent: req.headers.get('user-agent'),
        },
      }),
    ])

    // Clears the onboarding step so the person moves on to "Awaiting approval".
    await syncUserMetadata(profile)
    return NextResponse.json({ redirectTo: '/pending' })
  } catch (err) {
    logError('auth.complete_application.failed', err, { path: '/api/auth/complete-application' })
    return NextResponse.json(
      { error: publicErrorMessage(err, 'We could not submit your application right now. Please try again shortly.') },
      { status: 503 },
    )
  }
}
