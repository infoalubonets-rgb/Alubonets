import { NextRequest, NextResponse } from 'next/server'
import { getAccountProfile } from '@/lib/auth/session'
import { switchWorkspace } from '@/app/actions/workspace'

export async function POST(request: NextRequest) {
  // Cookie authentication must not allow another website to change the active workspace.
  const origin = request.headers.get('origin')
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const account = await getAccountProfile()
  if (!account || account.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  }
  try {
    const body = await request.json()
    if (typeof body?.role !== 'string') {
      return NextResponse.json({ error: 'Select a valid workspace.' }, { status: 400 })
    }
    await switchWorkspace(body.role)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error && /deactivated|do not have access/.test(error.message)
      ? error.message
      : 'That workspace is unavailable or you do not have access.'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
