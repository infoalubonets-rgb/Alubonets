import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

/**
 * Public pages only. Event and project detail pages are left out because visitors who are not
 * signed in (including search engines) only see a sign-in prompt there.
 */
const PAGES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '', changeFrequency: 'weekly', priority: 1 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/events', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/projects', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/gallery', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.7 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return PAGES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
