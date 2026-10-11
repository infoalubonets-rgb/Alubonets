/**
 * Email codes at sign-in ("Verify your sign-in") and on the membership application ("Verify email").
 *
 * Switched OFF until the group's sending domain is verified in Resend. All the verification code
 * stays in place: set `NEXT_PUBLIC_EMAIL_VERIFICATION=on` (Vercel and `.env.local`) and redeploy to
 * turn both checks back on. Read at build time, so it works in middleware, routes and the browser.
 */
export const EMAIL_VERIFICATION_ON = process.env.NEXT_PUBLIC_EMAIL_VERIFICATION === 'on'
