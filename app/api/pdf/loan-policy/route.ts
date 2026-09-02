import { NextRequest, NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/session'
import { getLoanPolicyDocument } from '@/lib/settings'
import { buildLoanPolicyPdf, loanPolicyFilename } from '@/lib/pdf/loan-policy'

export async function GET(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const policy = await getLoanPolicyDocument()
  const bytes = await buildLoanPolicyPdf(policy)
  const filename = loanPolicyFilename(policy.title)

  const download = req.nextUrl.searchParams.get('download') === '1'
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
    },
  })
}
