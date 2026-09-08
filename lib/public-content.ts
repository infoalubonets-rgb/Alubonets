import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { ContentGroup } from '@prisma/client'

export const CONTENT_DEFAULTS: Record<ContentGroup, Record<string, string>> = {
  HOME: { headline: 'One Family, One Vision, Endless Possibilities.', introduction: 'Alubonets Self-Help Group brings together the descendants of the Alubokho family to strengthen unity, provide welfare support and create opportunities for social and economic development.', mission: 'To unite, empower and support members through collective action, welfare initiatives and sustainable development.', vision: 'A united, prosperous and empowered family community.', highlightTitle: 'Building together', highlightText: 'Welfare, opportunity and lasting family connections.' },
  ABOUT: { title: 'About Alubonets', introduction: 'A family self-help group built on unity, welfare and shared progress.', history: 'Our story continues through every generation.', values: 'Unity, integrity, service and accountability.' },
  CONTACT: { email: 'infoalubonets@gmail.com', phone: 'Coming soon', location: 'Butere, Kakamega County, Kenya', introduction: "Have a question or want to connect? We'd love to hear from you." },
  FOOTER: { description: 'Alubonets Self-Help Group', copyright: 'Alubonets Self-Help Group', whatsappUrl: '', facebookUrl: '', instagramUrl: '', youtubeUrl: '' },
  ACTIVITIES: { welfare: 'Supporting members through collective welfare.', development: 'Creating social and economic opportunities.', community: 'Strengthening family and community connections.' },
  SOCIAL_LINKS: { whatsappUrl: '', facebookUrl: '', instagramUrl: '', youtubeUrl: '' },
}
const getCachedPublicContent = unstable_cache(
  async (group: ContentGroup) => {
    const content = await prisma.publicContent.findUnique({ where: { group } })
    return (content?.publishedData as Record<string, string> | null) || CONTENT_DEFAULTS[group]
  },
  ['public-content'],
  { revalidate: 300, tags: ['public-content'] },
)

export async function getPublicContent(group: ContentGroup) {
  return getCachedPublicContent(group)
}
