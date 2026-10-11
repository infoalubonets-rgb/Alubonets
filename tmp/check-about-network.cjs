require('@next/env').loadEnvConfig(process.cwd())
async function check(name, url, headers = {}) {
  try { const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000), redirect: 'manual' }); console.log(name + ': HTTP ' + r.status) }
  catch (e) { console.log(name + ': ' + e.message + ' (' + (e.cause?.code || e.name) + ')') }
}
Promise.all([
  check('Local About profiles route', 'http://localhost:3001/admin/members/about'),
  check('Supabase Auth', process.env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/health', { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' }),
])
