import type { Metadata } from 'next'
import { CONTACT_EMAIL } from '@/lib/constants'

/** Canonical public address. Every canonical link, sitemap entry and social preview points here. */
export const SITE_URL = 'https://www.alubonets.com'
export const SITE_NAME = 'Alubonets SHG'
export const SITE_LEGAL_NAME = 'Alubonets Self-Help Group'
export const SITE_DESCRIPTION =
  'Alubonets Self-Help Group unites the descendants of the Alubokho family in Butere, Kakamega County, Kenya, to strengthen unity, provide welfare support and create opportunities for social and economic development.'
export const SITE_KEYWORDS = [
  'Alubonets',
  'Alubonets SHG',
  'Alubonets Self-Help Group',
  'Alubokho family',
  'self-help group Kenya',
  'Butere',
  'Kakamega County',
  'family welfare group',
  'community development Kenya',
  'chama Kenya',
]

/** Only the production deployment may be indexed; previews and local runs stay out of search results. */
export const isIndexable = () => process.env.VERCEL_ENV === 'production'

/**
 * Per-page metadata with a canonical link and matching social preview text.
 * `path` is the page's own path, e.g. '/about'.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} - ${SITE_NAME}`, description, url: path },
    twitter: { title: `${title} - ${SITE_NAME}`, description },
  }
}

/** Organization + WebSite structured data for Google's knowledge panel and site name. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NGO',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_LEGAL_NAME,
        alternateName: ['Alubonets', SITE_NAME],
        url: SITE_URL,
        logo: `${SITE_URL}/icons/android-chrome-512x512.png`,
        description: SITE_DESCRIPTION,
        email: CONTACT_EMAIL,
        slogan: 'One Family, One Vision, Endless Possibilities.',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Butere',
          addressRegion: 'Kakamega County',
          addressCountry: 'KE',
        },
        areaServed: { '@type': 'Country', name: 'Kenya' },
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: CONTACT_EMAIL,
          url: `${SITE_URL}/contact`,
          availableLanguage: ['English', 'Swahili'],
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: SITE_LEGAL_NAME,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en-KE',
      },
    ],
  }
}
