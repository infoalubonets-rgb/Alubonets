# Security status

Last reviewed: 30 July 2026

## Dependency audit

Safe patch updates were applied, including Next.js 15.5.22 and Vitest 3.2.7.

`npm audit --omit=dev` still reports high-severity advisories through transitive `postcss` and `sharp` packages used by Next.js. npm currently proposes `npm audit fix --force`, but its proposed resolution downgrades Next.js to 9.3.3. That would be a breaking and unsafe remediation for this application and must not be applied.

Required follow-up:

1. Re-run `npm audit --omit=dev` during each dependency review.
2. Upgrade to a compatible patched Next.js release when available.
3. Re-run type checks, tests and the production build after upgrading.
4. Do not use `npm audit fix --force` without reviewing the exact dependency plan.

## Implemented controls

- Supabase Auth and server-side session validation
- Role/status checks in middleware and server actions
- Supabase RLS policies
- Git-ignored local secrets
- Central environment validation
- Structured server logging
- Database health endpoint
- Development account selector excluded from production UI
- CI type checking, tests and Prisma validation
- Production migration baseline

## Outstanding controls

- Add rate limiting to login, registration and contact submission.
- Add CAPTCHA or equivalent bot protection to public forms.
- Add password reset and privileged-role MFA.
- Create a separate staging Supabase project.
- Configure Sentry and an external uptime monitor.
- Define personal-data and uploaded-file retention rules.
