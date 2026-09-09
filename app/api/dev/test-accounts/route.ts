import { NextResponse } from 'next/server'
import { getTestAccounts, testAccountsEnabled } from '@/lib/dev-test-accounts'

export const dynamic = 'force-dynamic'

/** Optional JSON mirror of the client autofill list (testing only). */
export async function GET() {
  if (!testAccountsEnabled()) {
    return NextResponse.json({ error: 'Test accounts disabled.' }, { status: 404 })
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
