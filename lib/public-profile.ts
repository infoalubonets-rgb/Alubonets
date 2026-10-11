export const PUBLIC_PROFILE_FIELDS = [
  { key: 'photo', label: 'Profile photo' },
  { key: 'profession', label: 'Profession' },
  { key: 'location', label: 'Location' },
  { key: 'email', label: 'Email address' },
  { key: 'phone', label: 'Phone number' },
  { key: 'skills', label: 'Skills' },
  { key: 'educationLevel', label: 'Education' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'mentorshipArea', label: 'Mentorship' },
  { key: 'interests', label: 'Interests' },
  { key: 'biography', label: 'Biography' },
  { key: 'responsibilities', label: 'Responsibilities' },
  { key: 'more', label: 'Allow More details section' },
] as const

export type PublicProfileField = (typeof PUBLIC_PROFILE_FIELDS)[number]['key']

const KEYS = new Set<string>(PUBLIC_PROFILE_FIELDS.map((field) => field.key))

export function sanitizePublicProfileFields(values: readonly string[]): PublicProfileField[] {
  return Array.from(new Set(values.filter((value) => KEYS.has(value)))) as PublicProfileField[]
}
