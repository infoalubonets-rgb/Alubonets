import { z } from 'zod'

export const POLICY_VERSION = '2026-07-30-v1'

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
  familyBranch: requiredText('Family branch', 120),
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
})

export type RegistrationInput = z.infer<typeof registrationSchema>

export function requestIp(req: Request) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  )
}

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
  year = new Date().getFullYear()
) {
  const sequence = await tx.membershipSequence.upsert({
    where: { year },
    create: { year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  })
  return `ALU-${year}-${String(sequence.lastValue).padStart(3, '0')}`
}
