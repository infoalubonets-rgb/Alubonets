/**
 * Netlify Scheduled Function — hourly maintenance.
 * Calls the Next.js route with CRON_SECRET from site env.
 *
 * Schedule: every hour at minute 0
 */
const path = '/api/cron/stage4-maintenance'

export default async () => {
  const secret = process.env.CRON_SECRET?.trim()
  const base = (
    process.env.CRON_BASE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).replace(/\/$/, '')

  if (!secret) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET missing' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })
  }
  if (!base) {
    return new Response(JSON.stringify({ error: 'App URL missing' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })
  }

  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  })
  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
  })
}

export const config = {
  schedule: '0 * * * *',
}
