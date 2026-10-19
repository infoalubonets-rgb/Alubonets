import type { MetadataRoute } from 'next'
import { SITE_URL, isIndexable } from '@/lib/seo'

// Member, admin and account areas are private; keep crawlers on the public pages.
const PRIVATE_PATHS = [
  '/api/',
  '/admin',
  '/dashboard',
  '/profile',
  '/contributions',
  '/announcements',
  '/financial-reports',
  '/documents',
  '/governance',
  '/directory',
  '/today',
  '/notifications',
  '/meetings-reports',
  '/reports',
  '/support-chat',
  '/pending',
  '/account-setup',
  '/auth/',
  '/verify-login',
  '/forgot-password',
  '/reset-password',
  '/reset_password',
]

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
