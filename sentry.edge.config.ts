import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampler: ({ name, inheritOrSampleWith }) => {
    if (name.includes('/api/health')) return 0
    return inheritOrSampleWith(
      process.env.NODE_ENV === 'development' ? 1.0 : 0.1
    )
  },
})
