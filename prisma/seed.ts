/**
 * Seeds reference data + local testing role profiles (upsert, no wipe by default).
 *
 * SUPER_ADMIN_EMAIL / SUPER_ADMIN_FULL_NAME — real Super Admin (optional)
 * SEED_DEMO_ACCOUNTS=false — skip @alubonets.com role accounts
 * SEED_RESET=1 — destructive wipe (never on production)
 */
import {
  PrismaClient,
  PaymentMethod,
  ProjectStatus,
  Role,
  MemberStatus,
  WelfareStatus,
} from '@prisma/client'

const prisma = new PrismaClient()

async function upsertUser(data: {
  email: string
  fullName: string
  phone?: string
  role: Role
  status: MemberStatus
  isSuperAdmin?: boolean
  isPrincipal?: boolean
  dashboardAccess?: Role[]
  familyRegistrationState?: 'STANDARD' | 'RECORD_ONLY'
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } })
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName: data.fullName,
        phone: data.phone,
        role: data.role,
        status: data.status,
        isSuperAdmin: data.isSuperAdmin ?? false,
        isPrincipal: data.isPrincipal ?? false,
        dashboardAccess: data.dashboardAccess ?? [],
        familyRegistrationState: data.familyRegistrationState,
      },
    })
  }
  return prisma.user.create({
    data: {
      email: data.email,
      fullName: data.fullName,
      phone: data.phone,
      role: data.role,
      status: data.status,
      isSuperAdmin: data.isSuperAdmin ?? false,
      isPrincipal: data.isPrincipal ?? false,
      dashboardAccess: data.dashboardAccess ?? [],
      familyRegistrationState: data.familyRegistrationState,
    },
  })
}

async function main() {
  console.log('Seeding Alubonets...')

  if (process.env.SEED_RESET === '1') {
    console.warn('SEED_RESET=1 — wiping transactional tables.')
    await prisma.emailLog.deleteMany()
    await prisma.contribution.deleteMany()
    await prisma.welfareRequest.deleteMany()
    await prisma.galleryPhoto.deleteMany()
    await prisma.announcement.deleteMany()
    await prisma.document.deleteMany()
    await prisma.meeting.deleteMany()
    await prisma.event.deleteMany()
    await prisma.project.deleteMany()
    await prisma.familyInvite.deleteMany()
    await prisma.user.deleteMany()
  }

  const prescribedCategories = [
    'Constitution',
    'Policy',
    'Minutes',
    'Finance',
    'Project',
    'Correspondence',
    'Other',
  ] as const
  for (const name of prescribedCategories) {
    await prisma.documentCategory.upsert({
      where: { name },
      create: { name, active: true },
      update: { active: true },
    })
  }

  const allAccess = [
    Role.ADMIN,
    Role.EXECUTIVE,
    Role.TREASURER,
    Role.SECRETARY,
    Role.ORGANIZER,
    Role.MEMBER,
  ]

  const superEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase()
  if (superEmail) {
    await upsertUser({
      email: superEmail,
      fullName: process.env.SUPER_ADMIN_FULL_NAME?.trim() || 'Super Administrator',
      role: Role.ADMIN,
      status: MemberStatus.ACTIVE,
      isSuperAdmin: true,
      dashboardAccess: allAccess,
    })
    console.log(`Super Admin profile: ${superEmail}`)
  }

  if (process.env.SEED_DEMO_ACCOUNTS === 'false') {
    console.log('SEED_DEMO_ACCOUNTS=false — skipped role test accounts.')
    console.log('Seed complete.')
    return
  }

  const admin = await upsertUser({
    email: 'superadmin@alubonets.com',
    fullName: 'Super Administrator',
    phone: '+254700000001',
    role: Role.ADMIN,
    status: MemberStatus.ACTIVE,
    isSuperAdmin: !superEmail,
    dashboardAccess: allAccess,
  })

  await upsertUser({
    email: 'admin@alubonets.com',
    fullName: 'System Administrator',
    phone: '+254700000002',
    role: Role.ADMIN,
    status: MemberStatus.ACTIVE,
    dashboardAccess: [Role.ADMIN],
  })

  const executive = await upsertUser({
    email: 'executive@alubonets.com',
    fullName: 'Executive Chair',
    role: Role.EXECUTIVE,
    status: MemberStatus.ACTIVE,
  })

  const treasurer = await upsertUser({
    email: 'treasurer@alubonets.com',
    fullName: 'Group Treasurer',
    role: Role.TREASURER,
    status: MemberStatus.ACTIVE,
  })

  const secretary = await upsertUser({
    email: 'secretary@alubonets.com',
    fullName: 'Group Secretary',
    role: Role.SECRETARY,
    status: MemberStatus.ACTIVE,
  })

  const organizer = await upsertUser({
    email: 'organizer@alubonets.com',
    fullName: 'Events Organizer',
    role: Role.ORGANIZER,
    status: MemberStatus.ACTIVE,
  })

  const member = await upsertUser({
    email: 'member@alubonets.com',
    fullName: 'Jane Member',
    phone: '+254700000099',
    role: Role.MEMBER,
    status: MemberStatus.ACTIVE,
  })

  const principal = await upsertUser({
    email: 'principal@alubonets.com',
    fullName: 'Principal Otieno',
    phone: '+254700000088',
    role: Role.MEMBER,
    status: MemberStatus.ACTIVE,
    isPrincipal: true,
    familyRegistrationState: 'STANDARD',
  })

  await upsertUser({
    email: 'pending@alubonets.com',
    fullName: 'Pending Applicant',
    role: Role.MEMBER,
    status: MemberStatus.PENDING,
  })

  const members = [admin, executive, treasurer, secretary, organizer, member, principal]
  const existingContributions = await prisma.contribution.count()
  if (existingContributions === 0) {
    for (const [i, u] of members.entries()) {
      await prisma.contribution.create({
        data: {
          userId: u.id,
          amount: 1000 + i * 250,
          description: 'Monthly contribution',
          category: 'Monthly',
          paymentMethod: i % 2 === 0 ? PaymentMethod.MPESA : PaymentMethod.CASH,
          receivedBy: treasurer.fullName,
          mpesaRef: i % 2 === 0 ? `MPESA-${1000 + i}` : null,
          paidAt: new Date(Date.now() - i * 86400000 * 7),
        },
      })
    }
  }

  if ((await prisma.welfareRequest.count()) === 0) {
    await prisma.welfareRequest.create({
      data: {
        userId: member.id,
        description: 'Medical support for family member',
        amount: 15000,
        status: WelfareStatus.PENDING,
      },
    })
  }

  if ((await prisma.project.count()) === 0) {
    await prisma.project.createMany({
      data: [
        {
          title: 'Community Borehole',
          description: 'Water access improvement for Alubokho families.',
          status: ProjectStatus.ONGOING,
          startDate: new Date('2026-01-15'),
        },
        {
          title: 'Youth Skills Workshop',
          description: 'Training program for members under 35.',
          status: ProjectStatus.UPCOMING,
          startDate: new Date('2026-08-01'),
        },
        {
          title: 'School Fees Support 2025',
          description: 'Completed bursary cycle.',
          status: ProjectStatus.COMPLETED,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
        },
      ],
    })
  }

  console.log('Seed complete. Test role emails ready — run npm run db:bootstrap-auth')
  console.log('Autofill passwords: SUPER_ADMIN_PASSWORD + SEED_AUTH_PASSWORD in .env.local')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
