import type { Metadata } from 'next'
import { Sora, Inter } from 'next/font/google'
import './globals.css'
import AuthModal from '@/components/AuthModal'
import SiteScripts from '@/components/SiteScripts'

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

export const metadata: Metadata = {
  title: {
    default: 'Alubonets SHG',
    template: '%s - Alubonets SHG',
  },
  description:
    'Alubonets Self-Help Group — uniting the descendants of the Alubokho family to strengthen unity, provide welfare support and create opportunities for social and economic development.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body
        className={`${sora.variable} ${inter.variable} bg-background text-on-background font-body-md text-body-md antialiased min-h-screen flex flex-col`}
      >
        {children}
        <AuthModal />
        <SiteScripts />
      </body>
    </html>
  )
}
