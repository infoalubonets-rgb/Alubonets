import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createServerClient as createServiceClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { syncUserMetadata } from '@/lib/auth/session'
import { toAuthUser } from '@/lib/auth/helpers'
import { ROLE_HOME } from '@/lib/auth/types'
import { POLICY_VERSION, registrationSchema, requestIp } from '@/lib/membership'
import { enforceRateLimit } from '@/lib/rate-limit'
import { COOKIE_NAME, registrationEmailIsVerified } from '@/lib/registration-email-verification'
import { getFamilyInviteByToken, markFamilyInviteAccepted } from '@/lib/family-invite'
import { logError } from '@/lib/logger'
import { publicErrorMessage } from '@/lib/safe-error'
import { EMAIL_VERIFICATION_ON } from '@/lib/auth/email-verification-switch'

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
      EMAIL_VERIFICATION_ON &&
      !(await registrationEmailIsVerified(registrationCookies.get(COOKIE_NAME)?.value, email))
    ) {
      return NextResponse.json({ error: 'Verify your email before submitting the application.' }, { status: 403 })
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

    // An invite sent by an Admin pre-approves the account and keeps the role, principal and
    // branch the Admin chose — the person goes straight in instead of waiting for approval.
    const inviter = invite
      ? await prisma.user.findUnique({ where: { id: invite.invitedById }, select: { role: true, isSuperAdmin: true } })
      : null
    const preApproved = Boolean(existing && inviter && (inviter.role === 'ADMIN' || inviter.isSuperAdmin))

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
      role: preApproved && existing ? existing.role : ('MEMBER' as const),
      status: preApproved ? ('ACTIVE' as const) : ('PENDING' as const),
      isSuperAdmin: false,
      dashboardAccess: preApproved && existing ? existing.dashboardAccess : ([] as []),
      ...(preApproved ? { approvedAt: existing?.approvedAt ?? new Date() } : {}),
      ...(invite
        ? {
            principalMemberId: invite.user.principalMemberId,
            familyRelationship: invite.user.familyRelationship,
            familyRegistrationState: !preApproved
              ? ('INVITED' as const)
              : invite.user.principalMemberId ? ('ACTIVE_ATTACHED' as const) : ('STANDARD' as const),
            isPrincipal: preApproved && existing ? existing.isPrincipal : false,
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
      redirectTo: preApproved ? ROLE_HOME[profile.role] : '/pending',
      status: profile.status,
    })
  } catch (err) {
    logError('auth.registration.failed', err, { path: '/api/auth/register' })
    return NextResponse.json({ error: publicErrorMessage(err, 'We could not complete registration right now. Please try again shortly.') }, { status: 503 })
  }
}
