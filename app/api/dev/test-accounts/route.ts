import { NextResponse } from 'next/server'
import { getTestAccounts } from '@/lib/dev-test-accounts'

export const dynamic = 'force-dynamic'

/** Optional JSON mirror of the client autofill list (local testing). */
export async function GET() {
  if (process.env.NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS === 'false') {
    return NextResponse.json({ error: 'Test accounts disabled.' }, { status: 404 })
  }
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production.' }, { status: 404 })
  }

  const accounts = getTestAccounts()
  if (accounts.length === 0) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_SEED_AUTH_PASSWORD / NEXT_PUBLIC_SUPER_ADMIN_PASSWORD not set.' },
      { status: 503 },
    )
  }

  return NextResponse.json({ accounts })
}
