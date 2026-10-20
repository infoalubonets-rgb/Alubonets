import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// Browser-side the site only talks to itself, Supabase (auth, storage uploads) and Sentry.
// Scripts stay 'unsafe-inline' because Next.js hydration uses inline scripts without nonces.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io${process.env.NODE_ENV === 'production' ? '' : ' ws:'}`,
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  // Older browsers that ignore frame-ancestors: no framing by other sites (clickjacking).
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
]

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    // Pages that are identical for every visitor (the navbar loads the account in the browser).
    // Next marks them `max-age=0, must-revalidate`, so each visit from Kenya went back to the
    // Dublin region; letting Vercel's nearby edge cache them for a minute, and serve a slightly
    // older copy while it refreshes, removes that round trip. Admin edits appear within ~1 minute.
    const edgeCached = ['/', '/about', '/contact', '/privacy', '/terms'].map((source) => ({
      source,
      headers: [{ key: 'Vercel-CDN-Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=86400' }],
    }))
    return [{ source: '/:path*', headers: securityHeaders }, ...edgeCached]
  },
  async redirects() {
    return [
      // Email clients / old copy sometimes use underscore; the real page is hyphenated.
      {
        source: '/reset_password',
        destination: '/reset-password',
        permanent: false,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  // Webpack does not understand the `node:` URI scheme by default; map it so
  // server-only crypto imports never become UnhandledSchemeError overlays.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'node:crypto': 'crypto',
    }
    return config
  },
}

export default withSentryConfig(nextConfig, {
  org: 'alubonets',
  project: 'javascript-nextjs',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
})
