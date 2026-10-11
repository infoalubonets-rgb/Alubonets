import { WORKSPACE_COOKIE } from '@/lib/auth/workspace'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(WORKSPACE_COOKIE)
  cookieStore.delete('alubonets_last_active')
  const supabase = createClient(cookieStore)
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // Session may already be invalid — cookies are cleared regardless.
  }
}

export async function POST() {
  await clearSession()
  return NextResponse.json({ ok: true })
}

// One-hop sign-out: the browser navigates here, cookies are cleared and the
// redirect lands on the right login page — no client round trip first.
export async function GET(req: Request) {
  await clearSession()
  const url = new URL(req.url)
  const dest = new URL(url.searchParams.get('to') === 'admin' ? '/admin/login' : '/login', url.origin)
  const reason = url.searchParams.get('error')
  if (reason === 'role_inactive') dest.searchParams.set('error', reason)
  return NextResponse.redirect(dest, { status: 303 })
}
