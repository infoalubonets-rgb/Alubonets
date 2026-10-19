import type { Metadata } from 'next'
import { Sora, Inter, Orbitron } from 'next/font/google'
import './globals.css'
import { getBranding } from '@/lib/settings'
import { SITE_KEYWORDS, SITE_LEGAL_NAME, SITE_URL, isIndexable, organizationJsonLd } from '@/lib/seo'

const sora = Sora({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-sora',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-inter',
})

const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['500', '600'],
  display: 'swap',
  variable: '--font-orbitron',
})

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding().catch(() => ({
    siteName: 'Alubonets',
    primaryHex: '#003366',
  }))
  const name = branding.siteName || 'Alubonets'
  const description = `${name} Self-Help Group unites the descendants of the Alubokho family in Butere, Kakamega County, Kenya, to strengthen unity, provide welfare support and create opportunities for social and economic development.`
  const indexable = isIndexable()
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${name} SHG`,
      template: `%s - ${name} SHG`,
    },
    description,
    keywords: SITE_KEYWORDS,
    authors: [{ name: SITE_LEGAL_NAME, url: SITE_URL }],
    creator: SITE_LEGAL_NAME,
    publisher: SITE_LEGAL_NAME,
    category: 'community',
    formatDetection: { telephone: false, email: false, address: false },
    robots: indexable
      ? { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } }
      : { index: false, follow: false },
    openGraph: {
      type: 'website',
      siteName: `${name} SHG`,
      locale: 'en_KE',
      url: '/',
      title: `${name} SHG`,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} SHG`,
      description,
    },
    applicationName: `${name} SHG`,
    manifest: '/site.webmanifest',
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
        { url: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
      shortcut: ['/icons/favicon-32x32.png'],
    },
    other: {
      'msapplication-TileColor': '#001f50',
      'msapplication-TileImage': '/icons/mstile-150x150.png',
    },
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover' as const,
  themeColor: '#001f50',
}

/**
 * Browser extensions (Bitdefender, Grammarly…) stamp attributes such as `bis_skin_checked` onto the
 * page before React hydrates, which React reports as a hydration mismatch. Strip them as they appear
 * until the page has settled.
 */
const STRIP_EXTENSION_ATTRIBUTES = `(function(){
  var names=['bis_skin_checked','bis_register','bis_use','bis_size','bis_id','data-gr-ext-installed','data-new-gr-c-s-check-loaded','data-new-gr-c-s-loaded','data-gramm','data-lt-installed'];
  function clean(el){for(var i=0;i<names.length;i++){if(el.hasAttribute&&el.hasAttribute(names[i]))el.removeAttribute(names[i]);}}
  var observer=new MutationObserver(function(list){for(var i=0;i<list.length;i++)clean(list[i].target);});
  observer.observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:names});
  window.addEventListener('load',function(){setTimeout(function(){observer.disconnect();},5000);});
})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: STRIP_EXTENSION_ATTRIBUTES }} />
        <link
          rel="preload"
          href="/fonts/material-icons.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${sora.variable} ${inter.variable} ${orbitron.variable} bg-background text-on-background font-body-md text-body-md antialiased min-h-screen flex flex-col`}
      >
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
      </body>
    </html>
  )
}
