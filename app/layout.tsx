import type { Metadata } from 'next'
import { Sora, Inter, Orbitron } from 'next/font/google'
import './globals.css'
import { getBranding } from '@/lib/settings'

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
  return {
    title: {
      default: `${name} SHG`,
      template: `%s - ${name} SHG`,
    },
    description:
      `${name} Self-Help Group — uniting the descendants of the Alubokho family to strengthen unity, provide welfare support and create opportunities for social and economic development.`,
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover' as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        <link
          rel="preload"
          href="/fonts/material-icons.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${sora.variable} ${inter.variable} ${orbitron.variable} bg-background text-on-background font-body-md text-body-md antialiased min-h-screen flex flex-col`}
      >
        {children}
      </body>
    </html>
  )
}
