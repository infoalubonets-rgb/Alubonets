/** Shared Auth cookie options so sessions survive new tabs and page navigation. */
export const AUTH_COOKIE_OPTIONS = {
  path: '/' as const,
  sameSite: 'lax' as const,
  // Long browser lifetime; Supabase still enforces access/refresh token expiry.
  maxAge: 60 * 60 * 24 * 400,
}
