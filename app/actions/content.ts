'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { CONTENT_DEFAULTS } from '@/lib/public-content'
import { writeAudit } from '@/lib/audit'
const groups = ['HOME','ABOUT','CONTACT','FOOTER','ACTIVITIES','SOCIAL_LINKS'] as const
export async function savePublicContent(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','EXECUTIVE'])
  const group = z.enum(groups).parse(formData.get('group'))
  const data = Object.fromEntries(Object.keys(CONTENT_DEFAULTS[group]).map((key) => [key, String(formData.get(key) || '').trim()]))
  const publish = formData.get('publish') === 'true'
  if (publish && actor.role !== 'ADMIN' && !actor.isSuperAdmin) throw new Error('Only Admin can publish content')
  const content = await prisma.publicContent.upsert({ where: { group }, create: { group, draftData: data, publishedData: publish ? data : undefined, status: publish ? 'PUBLISHED' : 'DRAFT', publishedAt: publish ? new Date() : null }, update: { draftData: data, ...(publish ? { publishedData: data, status: 'PUBLISHED' as const, publishedAt: new Date() } : { status: 'DRAFT' as const }) } })
  await prisma.publicContentVersion.create({ data: { contentId: content.id, editorId: actor.id, data, action: publish ? 'PUBLISH' : 'SAVE_DRAFT' } })
  await writeAudit({ userId: actor.id, action: publish ? 'PUBLIC_CONTENT_PUBLISH' : 'PUBLIC_CONTENT_DRAFT', entity: 'PublicContent', entityId: content.id, meta: { group } })
  for (const path of ['/','/about','/contact','/admin/content']) revalidatePath(path)
}
export async function saveCommitteeProfile(formData: FormData) {
  const actor = await requireActiveRole(['ADMIN','EXECUTIVE'])
  const publish = formData.get('publish') === 'true'
  if (publish && actor.role !== 'ADMIN' && !actor.isSuperAdmin) throw new Error('Only Admin can publish committee profiles')
  const data = {
    name: z.string().trim().min(2).max(120).parse(formData.get('name')),
    position: z.string().trim().min(2).max(120).parse(formData.get('position')),
    biography: z.string().trim().min(2).max(2000).parse(formData.get('biography')),
    photoUrl: String(formData.get('photoUrl') || '') || null,
    displayOrder: Number(formData.get('displayOrder') || 0),
    status: publish ? 'PUBLISHED' as const : 'DRAFT' as const,
    editedById: actor.id,
  }
  const profile = await prisma.committeeProfile.create({ data })
  await writeAudit({ userId: actor.id, action: publish ? 'COMMITTEE_PROFILE_PUBLISH' : 'COMMITTEE_PROFILE_DRAFT', entity: 'CommitteeProfile', entityId: profile.id })
  revalidatePath('/about'); revalidatePath('/admin/content')
}
