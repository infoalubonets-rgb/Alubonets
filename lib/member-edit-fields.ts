export type MemberEditValues = {
  fullName: string; phone: string; location: string; gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | null
  dateOfBirth: string | null; address: string; familyBranch: string
  memberCategory: 'ORDINARY' | 'COMMITTEE_MEMBER' | 'ADMIN' | 'EXECUTIVE' | 'TREASURER' | 'SECRETARY' | 'ORGANIZER' | 'MEMBER' | null
  nextOfKinName: string; nextOfKinPhone: string; nextOfKinRelationship: string
  emergencyContactName: string; emergencyContactPhone: string; profession: string
  educationLevel: 'PRIMARY' | 'SECONDARY' | 'CERTIFICATE' | 'DIPLOMA' | 'BACHELORS' | 'MASTERS' | 'DOCTORATE' | 'OTHER' | null
  skills: string; achievements: string; mentorshipArea: string; interests: string
}

export const memberEditFields: { key: keyof MemberEditValues; label: string; options?: string[] }[] = [
  { key: 'fullName', label: 'Full name' }, { key: 'phone', label: 'Phone' }, { key: 'location', label: 'Location' },
  { key: 'gender', label: 'Gender', options: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] },
  { key: 'dateOfBirth', label: 'Date of birth' }, { key: 'address', label: 'Address' }, { key: 'familyBranch', label: 'Family branch' },
  { key: 'memberCategory', label: 'Member category', options: ['ORDINARY', 'COMMITTEE_MEMBER', 'ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER'] },
  { key: 'nextOfKinName', label: 'Next of kin' }, { key: 'nextOfKinPhone', label: 'Next-of-kin phone' },
  { key: 'nextOfKinRelationship', label: 'Next-of-kin relationship' },
  { key: 'emergencyContactName', label: 'Emergency contact' }, { key: 'emergencyContactPhone', label: 'Emergency phone' },
  { key: 'profession', label: 'Profession' },
  { key: 'educationLevel', label: 'Education', options: ['PRIMARY', 'SECONDARY', 'CERTIFICATE', 'DIPLOMA', 'BACHELORS', 'MASTERS', 'DOCTORATE', 'OTHER'] },
  { key: 'skills', label: 'Skills' }, { key: 'achievements', label: 'Achievements' },
  { key: 'mentorshipArea', label: 'Mentorship area' }, { key: 'interests', label: 'Interests' },
]
