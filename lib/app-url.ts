import { SITE_URL } from '@/lib/seo'

/** Email links must use the public domain in production, never a retired deployment URL. */
export function appBaseUrl(requestUrl?: string) {
  if (process.env.NODE_ENV === 'production') return SITE_URL

  if (requestUrl) {
    const request = new URL(requestUrl)
    if (['localhost', '127.0.0.1', '[::1]'].includes(request.hostname)) return request.origin
  }

  try {
    const configured = new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3001')
    if (configured.hostname === 'alubonets.vercel.app') return SITE_URL
    if (configured.protocol === 'https:' || configured.protocol === 'http:') return configured.origin
  } catch {
    // Ignore invalid configuration rather than send a broken email link.
  }
  return 'http://localhost:3001'
}
