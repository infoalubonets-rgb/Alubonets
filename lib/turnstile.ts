export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'
export const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA'

export async function verifyTurnstile(token: string, ip?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY || (process.env.NODE_ENV === 'development' ? TURNSTILE_TEST_SECRET : '')
  if (!secret || !token) return false
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: ip || undefined }),
  })
  if (!response.ok) return false
  return Boolean((await response.json() as { success?: boolean }).success)
}
