'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSessionProfile, syncUserMetadata } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'

const profileSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().max(40).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
})

const memberDetailsSchema = z.object({
  phone: z.string().trim().min(1).max(40),
  location: z.string().trim().min(1).max(250),
  familyBranch: z.string().trim().min(1).max(120),
  nextOfKinName: z.string().trim().min(1).max(120),
  nextOfKinPhone: z.string().trim().min(1).max(40),
  nextOfKinRelationship: z.string().trim().min(1).max(80),
  profession: z.string().trim().min(1).max(120),
  skills: z.string().trim().min(1).max(1000),
  achievements: z.string().trim().min(1).max(2000),
  mentorshipArea: z.string().trim().min(1).max(500),
  interests: z.string().trim().min(1).max(1000),
  emergencyContactName: z.string().trim().min(1).max(120),
  emergencyContactPhone: z.string().trim().min(1).max(40),
  educationLevel: z.enum(['PRIMARY', 'SECONDARY', 'CERTIFICATE', 'DIPLOMA', 'BACHELORS', 'MASTERS', 'DOCTORATE', 'OTHER']),
})

export async function updateMyProfile(input: z.infer<typeof profileSchema>) {
  const session = await requireSessionProfile()
  const data = profileSchema.parse(input)

  const updated = await prisma.user.update({
    where: { id: session.id },
    data: {
      fullName: data.fullName.trim(),
      phone: data.phone?.trim() || null,
      location: data.location?.trim() || null,
    },
  })

  await syncUserMetadata(updated)
  await writeAudit({
    userId: session.id,
    action: 'PROFILE_UPDATE',
    entity: 'User',
    entityId: session.id,
  })

  revalidatePath('/profile')
  return updated
}

export async function updateMyMemberDetails(input: z.infer<typeof memberDetailsSchema>) {
  const session = await requireSessionProfile()
  const data = memberDetailsSchema.parse(input)
  const before = await prisma.memberProfile.findUnique({ where: { userId: session.id } })
  const { phone, location, ...profileData } = data

  await prisma.$transaction([
    prisma.user.update({ where: { id: session.id }, data: { phone, location } }),
    prisma.memberProfile.upsert({
      where: { userId: session.id },
      create: { userId: session.id, address: location, ...profileData },
      update: { address: location, ...profileData },
    }),
  ])
  await writeAudit({
    userId: session.id,
    action: 'MEMBER_PROFILE_DETAILS_UPDATE',
    entity: 'MemberProfile',
    entityId: before?.id,
    meta: { changedFields: Object.keys(data) },
  })
  revalidatePath('/profile')
}

export async function updateMyAvatarPath(path: string) {
  const session = await requireSessionProfile()
  const value = z.string().max(500).parse(path)
  if (!session.authUserId || !value.startsWith(`${session.authUserId}/`)) {
    throw new Error('Invalid avatar path')
  }
  await prisma.user.update({ where: { id: session.id }, data: { avatarUrl: value } })
  await writeAudit({ userId: session.id, action: 'PROFILE_AVATAR_UPDATE', entity: 'User', entityId: session.id })
  revalidatePath('/profile')
}
