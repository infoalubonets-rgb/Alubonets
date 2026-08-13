import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createServerClient as createServiceClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { syncUserMetadata } from '@/lib/auth/session'
import { toAuthUser } from '@/lib/auth/helpers'
import { POLICY_VERSION, registrationSchema, requestIp } from '@/lib/membership'
import { enforceRateLimit } from '@/lib/rate-limit'
import { COOKIE_NAME, registrationEmailIsVerified } from '@/lib/registration-email-verification'
import { getFamilyInviteByToken, markFamilyInviteAccepted } from '@/lib/family-invite'

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = registrationSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Complete every required registration field.' },
        { status: 400 }
      )
    }

    const data = parsed.data
    const { email, password, fullName, phone, inviteToken } = data
    const invite = inviteToken ? await getFamilyInviteByToken(inviteToken) : null
    if (inviteToken && !invite) {
      return NextResponse.json({ error: 'This family invite is invalid or has expired.' }, { status: 400 })
    }
    if (invite && invite.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Register with the email address that received the family invite.' },
        { status: 400 },
      )
    }

    const registrationCookies = await cookies()
    if (
      !invite &&
      !(await registrationEmailIsVerified(registrationCookies.get(COOKIE_NAME)?.value, email))
    ) {
      return NextResponse.json({ error: 'Verify your email before submitting the application.' }, { status: 403 })
    }
    const [minLenSetting, mixedSetting] = await Promise.all([
      prisma.appSetting.findUnique({ where: { key: 'password_min_length' } }),
      prisma.appSetting.findUnique({ where: { key: 'password_require_mixed' } }),
    ])
    const minLen = Number(minLenSetting?.value || 8)
    if (password.length < minLen) {
      return NextResponse.json(
        { error: `Password must be at least ${minLen} characters.` },
        { status: 400 },
      )
    }
    if (mixedSetting?.value === 'true') {
      const ok = /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)
      if (!ok) {
        return NextResponse.json(
          { error: 'Password must include upper, lower, and a number.' },
          { status: 400 },
        )
      }
    }
    const ipAddress = requestIp(req)
    await enforceRateLimit(`register:${ipAddress || email}`, 5, 30)
    const existing = await prisma.user.findUnique({ where: { email }, include: { memberProfile: true } })
    if (existing?.status === 'ACTIVE' && existing.authUserId) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please log in.' },
        { status: 409 }
      )
    }
    if (invite && existing && existing.id !== invite.user.id) {
      return NextResponse.json({ error: 'Invite does not match this email record.' }, { status: 400 })
    }

    const admin = createServiceClient()
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: {
        role: 'MEMBER',
        status: 'PENDING',
        isSuperAdmin: false,
        dashboardAccess: [],
        isPrincipal: false,
      },
    })

    if (error || !created.user) {
      const message = error?.message?.toLowerCase() ?? ''
      const friendly = message.includes('already been registered')
        ? 'An account with this email already exists. Please sign in instead.'
        : 'Could not create your account. Please try again.'
      return NextResponse.json({ error: friendly }, { status: 400 })
    }

    const profileBase = {
      authUserId: created.user.id,
      fullName,
      phone: phone || existing?.phone,
      location: data.location,
      role: 'MEMBER' as const,
      status: 'PENDING' as const,
      isSuperAdmin: false,
      dashboardAccess: [] as [],
      ...(invite
        ? {
            principalMemberId: invite.user.principalMemberId,
            familyRelationship: invite.user.familyRelationship,
            familyRegistrationState: 'INVITED' as const,
            isPrincipal: false,
          }
        : {}),
    }

    const profile = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: profileBase,
          include: { memberProfile: true },
        })
      : await prisma.user.create({
          data: {
            ...profileBase,
            email,
          },
          include: { memberProfile: true },
        })

    await prisma.$transaction([
      prisma.memberProfile.upsert({
        where: { userId: profile.id },
        create: {
          userId: profile.id,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth,
          address: data.location,
          familyBranch: invite ? (existing?.memberProfile?.familyBranch || data.familyBranch) : data.familyBranch,
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
        },
        update: {
          gender: data.gender,
          dateOfBirth: data.dateOfBirth,
          address: data.location,
          familyBranch: invite ? (existing?.memberProfile?.familyBranch || data.familyBranch) : data.familyBranch,
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
        },
      }),
      prisma.consentRecord.create({
        data: {
          userId: profile.id,
          termsVersion: POLICY_VERSION,
          privacyVersion: POLICY_VERSION,
          ipAddress,
          userAgent: req.headers.get('user-agent'),
        },
      }),
    ])

    if (inviteToken) {
      await markFamilyInviteAccepted(inviteToken, profile.id)
    }

    await syncUserMetadata(profile)

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    await supabase.auth.signInWithPassword({ email, password })
    cookieStore.delete(COOKIE_NAME)

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
