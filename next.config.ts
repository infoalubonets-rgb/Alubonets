import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  devIndicators: false,
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
