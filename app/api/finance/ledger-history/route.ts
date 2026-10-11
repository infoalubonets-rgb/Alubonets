import { canRecordPayments } from '@/lib/finance-access'
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { getLedgerHistory } from '@/lib/ledger-history'

export const dynamic = 'force-dynamic'

/** Transaction history for the Financial ledger pop-up; same access as the ledger page. */
export async function GET(request: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  const allowed =
    profile.isSuperAdmin ||
    profile.role === 'ADMIN' ||
    profile.role === 'TREASURER' ||
    (profile.dashboardAccess ?? []).includes('TREASURER')
  if (!allowed) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })

  const sp = request.nextUrl.searchParams
  const history = await getLedgerHistory({
    range: sp.get('range') ?? undefined,
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
    category: sp.get('category') ?? undefined,
    dir: sp.get('dir') ?? undefined,
    status: sp.get('status') ?? undefined,
    q: sp.get('q') ?? undefined,
    page: Number(sp.get('page')) || 1,
  }, { id: profile.id, canApprove: profile.role === 'ADMIN' || Boolean(profile.isSuperAdmin) || canRecordPayments(profile) })
  return NextResponse.json(history, { headers: { 'Cache-Control': 'private, no-store' } })
}


