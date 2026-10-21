import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { writeAudit } from '@/lib/audit'
import { NOT_DELETED_MEMBER } from '@/lib/deleted-member'

const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`

export async function GET() {
  const actor = await requireAdmin()
  const users = await prisma.user.findMany({
    where: NOT_DELETED_MEMBER,
    orderBy: { fullName: 'asc' },
    include: { memberProfile: true },
  })
  const headers = [
    'Membership number',
    'Full name',
    'Email',
    'Phone',
    'Role',
    'Status',
    'Member category',
    'Family branch',
    'Location',
    'Profession',
    'Education',
    'Skills',
    'Joined',
  ]
  const rows = users.map((user) => [
    user.membershipNumber,
    user.fullName,
    user.email,
    user.phone,
    user.role,
    user.status,
    user.memberProfile?.memberCategory,
    user.memberProfile?.familyBranch,
    user.location,
    user.memberProfile?.profession,
    user.memberProfile?.educationLevel,
    user.memberProfile?.skills,
    user.approvedAt?.toISOString(),
  ])
  const body = [headers, ...rows].map((row) => row.map(csv).join(',')).join('\r\n')
  await writeAudit({
    userId: actor.id,
    action: 'MEMBERS_EXPORT',
    entity: 'User',
    meta: { count: users.length, format: 'csv' },
  })
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="alubonets-members-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
