require('@next/env').loadEnvConfig(process.cwd())
const { PrismaClient } = require('@prisma/client')
const { createClient } = require('@supabase/supabase-js')
const db = new PrismaClient()
async function main() {
  const start = Date.now()
  const [users, profiles] = await Promise.all([
    db.user.findMany({ where: { OR: [{ role: 'EXECUTIVE' }, { dashboardAccess: { has: 'EXECUTIVE' } }] }, include: { memberProfile: { select: { profession: true, skills: true, educationLevel: true, achievements: true, mentorshipArea: true, interests: true } } } }),
    db.committeeProfile.findMany({ where: { userId: { not: null } }, orderBy: { updatedAt: 'desc' } }),
  ])
  console.log(JSON.stringify({ executiveAccounts: users.length, linkedProfiles: profiles.length, databaseMs: Date.now() - start }))
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  for (const user of users.filter(u => u.avatarUrl && !u.avatarUrl.startsWith('http'))) {
    const start = Date.now()
    try { const r = await client.storage.from('member-avatars').createSignedUrl(user.avatarUrl, 3600); console.log(JSON.stringify({ avatarAvailable: Boolean(r.data?.signedUrl), error: r.error?.message || null, ms: Date.now() - start })) }
    catch (e) { console.log(JSON.stringify({ avatarError: e.message, ms: Date.now() - start })) }
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1 }).finally(() => db.$disconnect())
