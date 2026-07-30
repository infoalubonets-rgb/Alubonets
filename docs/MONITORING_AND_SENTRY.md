# Monitoring and Sentry setup

## Available now

- Server errors can be written as structured JSON through `lib/logger.ts`.
- Netlify captures application `console` output in function/deploy logs.
- `/api/health` checks required environment configuration and database connectivity.

Configure an external uptime monitor to request `/api/health` every five minutes and alert when it does not return HTTP 200.

## Sentry

The official `@sentry/nextjs` SDK is configured for browser, Node.js and Edge
errors, App Router request errors, global React errors and performance tracing.
Health-check transactions are excluded. Default personal-data collection is
disabled.

The configured Sentry organization is `alubonets` and project is
`javascript-nextjs`.

Add these variables to Netlify now and Vercel when production moves there:

- `NEXT_PUBLIC_SENTRY_DSN`: the project DSN
- `SENTRY_DSN`: the same project DSN
- `NEXT_PUBLIC_APP_ENV`: `testing` on Netlify and `production` on Vercel
- `SENTRY_AUTH_TOKEN`: a secret organization token with source-map upload access

The application reports errors without `SENTRY_AUTH_TOKEN`. The token is needed
only during deployment to upload source maps, which make production stack traces
readable. Never commit it or expose it through a `NEXT_PUBLIC_` variable.

Configure Sentry alerts for:
   - Repeated login failures
   - Database connectivity failure
   - M-Pesa callback failure
   - Contact/notification email failure
   - HTTP 500 spikes

Do not send passwords, service keys, full database URLs, contribution details or private member data to Sentry.

## Resend testing limitation

Until an Alubonets domain is verified in Resend, keep
`FROM_EMAIL=Alubonets <onboarding@resend.dev>` and
`RESEND_TEST_EMAIL=infoalubonets@gmail.com`. The latter redirects outgoing test
messages to the verified account. After domain verification, replace `FROM_EMAIL`
with a sender on that domain and remove the test override.
