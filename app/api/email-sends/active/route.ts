import { NextResponse } from 'next/server'
import { getActiveEmailSends } from '@/lib/email-sends'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ sends: await getActiveEmailSends() }, { headers: { 'Cache-Control': 'no-store' } })
}
