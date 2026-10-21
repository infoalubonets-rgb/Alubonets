import { z } from 'zod'
import { appTodayInputValue } from '@/lib/dates'

export const POLICY_VERSION = '2026-10-20-v2'
// Shown on /privacy and /terms; update together with POLICY_VERSION.
export const POLICY_LAST_UPDATED = '20 October 2026'

export const MEMBER_CATEGORIES = [
  'ORDINARY',
  'COMMITTEE_MEMBER',
] as const

export const EDUCATION_LEVELS = [
  'PRIMARY',
  'SECONDARY',
  'CERTIFICATE',
  'DIPLOMA',
  'BACHELORS',
  'MASTERS',
  'DOCTORATE',
  'OTHER',
] as const

export const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const

const requiredText = (label: string, max = 500) =>
  z.string().trim().min(1, `${label} is required`).max(max)

export const registrationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/\d/, 'Password must include a number')
    .regex(/[^A-Za-z0-9]/, 'Password must include a special character'),
  fullName: requiredText('Full name', 120),
  phone: requiredText('Phone', 40),
  location: requiredText('Location/address', 250),
  gender: z.enum(GENDERS),
  dateOfBirth: z.coerce.date().refine((date) => date < new Date(), 'Date of birth must be in the past'),
  familyBranch: z.string().trim().max(120).optional().transform((value) => value || undefined),
  nextOfKinName: requiredText('Next of kin name', 120),
  nextOfKinPhone: requiredText('Next of kin phone', 40),
  nextOfKinRelationship: requiredText('Next-of-kin relationship', 80),
  profession: requiredText('Profession/occupation', 120),
  skills: requiredText('Skills', 1000),
  educationLevel: z.enum(EDUCATION_LEVELS),
  achievements: requiredText('Achievements', 2000),
  mentorshipArea: requiredText('Mentorship area', 500),
  interests: requiredText('Interests', 1000),
  emergencyContactName: requiredText('Emergency contact name', 120),
  emergencyContactPhone: requiredText('Emergency contact phone', 40),
  memberCategory: z.enum(MEMBER_CATEGORIES),
  consentAccepted: z.literal(true),
  termsVersion: z.literal(POLICY_VERSION),
  privacyVersion: z.literal(POLICY_VERSION),
  inviteToken: z.string().trim().min(10).optional(),
})

/** The same application for someone already signed in (e.g. with Google): no email or password. */
export const applicationSchema = registrationSchema.omit({ email: true, password: true, inviteToken: true })

export type RegistrationInput = z.infer<typeof registrationSchema>

/** Client IP for rate limits and audit logs. Vercel sets these headers itself, so prefer them. */
export function requestIp(req: Request) {
  return (
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null
  )
}

/** membership_sequences row holding the single system-wide member counter. */
export const MEMBER_ID_SEQUENCE_KEY = 0

export async function nextMembershipNumber(
  tx: {
    membershipSequence: {
      upsert: (args: {
        where: { year: number }
        create: { year: number; lastValue: number }
        update: { lastValue: { increment: number } }
      }) => Promise<{ lastValue: number }>
    }
  },
  now = new Date()
) {
  const [year, month, day] = appTodayInputValue(now).split('-').map(Number)
  // One counter for the whole system, so the number says how many members have joined (006 = 6th).
  const sequence = await tx.membershipSequence.upsert({
    where: { year: MEMBER_ID_SEQUENCE_KEY },
    create: { year: MEMBER_ID_SEQUENCE_KEY, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  })
  return formatMemberId(year, month, day, sequence.lastValue)
}

/**
 * Permanent member ID: AL + YYMMDD of approval + system-wide member number, e.g. AL261003-006
 * for the 6th member, approved on 3 October 2026.
 */
export function formatMemberId(year: number, month: number, day: number, counter: number) {
  const two = (value: number) => String(value).padStart(2, '0')
  return `AL${two(year % 100)}${two(month)}${two(day)}-${String(counter).padStart(3, '0')}`
}
