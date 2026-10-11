const fs = require('fs')
fs.writeFileSync('app/admin/announcements/about/page.tsx', `import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/session'
export default async function OldAboutProfilesPage() { await requireAdmin(); redirect('/admin/members/about') }
`)
const f = 'app/(public)/about/page.tsx'
let s = fs.readFileSync(f, 'utf8')
const start = s.indexOf('async function loadCommittee()')
const end = s.indexOf('export default async function AboutPage()', start)
s = s.slice(0, start) + `async function loadCommittee(): Promise<CommitteeCard[]> {
  const executives = await prisma.user.findMany({
    where: { status: 'ACTIVE', showOnAbout: true, OR: [{ role: 'EXECUTIVE' }, { dashboardAccess: { has: 'EXECUTIVE' } }] },
    orderBy: [{ aboutOrder: 'asc' }, { fullName: 'asc' }],
    select: { id: true, fullName: true, aboutTitle: true, ...profileUserSelect },
  })
  const profiles = executives.length ? await prisma.committeeProfile.findMany({ where: { userId: { in: executives.map(user => user.id) } }, orderBy: { updatedAt: 'desc' } }) : []
  return Promise.all(executives.map(async user => {
    const profile = profiles.find(profile => profile.userId === user.id)
    const allowed = new Set(user.publicProfileFields)
    const more = allowed.has('more')
    const role = user.aboutTitle || 'Executive Committee'
    return { name: user.fullName, role, alt: user.fullName + ', ' + role,
      photoUrl: await allowedPhoto(user),
      responsibilities: more && allowed.has('responsibilities') ? (profile?.responsibilities || '').split('\\n').map(line => line.replace(/^[-•*]\\s*/, '').trim()).filter(Boolean) : [],
      biography: more && allowed.has('biography') ? profile?.biography || '' : '',
      details: more ? publicDetails(user) : [],
    }
  }))
}

` + s.slice(end)
s = s.replace('                {member.details.map((detail) => (', '                {rich && <details className="mt-3 w-full"><summary className="cursor-pointer text-center text-sm font-semibold text-primary">More</summary>\n                {member.details.map((detail) => (')
s = s.replace('              </div>\n            )\n          })}', '                </details>}\n              </div>\n            )\n          })}')
fs.writeFileSync(f, s)
