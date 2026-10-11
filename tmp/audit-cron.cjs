require('@next/env').loadEnvConfig(process.cwd())
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()
const scrub = value => String(value || '').replace(/https?:\/\/[^\s'"<>]+/g, url => { try { const u = new URL(url); return u.origin + u.pathname } catch { return '[url]' } }).replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/eyJ[A-Za-z0-9_.-]+/g, '[token]').replace(/(?:sb_secret_|ghp_|sk_live_)[A-Za-z0-9_-]+/g, '[token]')
async function main() {
  const ext = await db.$queryRawUnsafe("select extname from pg_extension where extname in ('pg_cron','pg_net')")
  console.log('Extensions', JSON.stringify(ext))
  if (!ext.some(e => e.extname === 'pg_cron')) return
  const jobs = await db.$queryRawUnsafe('select jobid::text, jobname, schedule, active, command from cron.job order by jobid')
  for (const job of jobs) {
    const urls = [...job.command.matchAll(/https?:\/\/[^\s'"<>]+/g)].map(m => scrub(m[0]))
    console.log(JSON.stringify({ id: job.jobid, name: job.jobname, schedule: job.schedule, active: job.active, targets: urls, sqlShape: scrub(job.command.replace(/'(?:[^']|'')*'/g, "'[value]'")) }))
  }
  const runs = await db.$queryRawUnsafe("select jobid::text, status, start_time, end_time, return_message from cron.job_run_details where start_time > now() - interval '7 days' order by start_time desc limit 100")
  const summaries = jobs.map(job => { const r = runs.filter(r => r.jobid === job.jobid); return { job: job.jobname, recentRuns: r.length, failed: r.filter(r => r.status === 'failed').length, last: r[0] && { ...r[0], return_message: scrub(r[0].return_message) } } })
  console.log('Recent runs (latest 100)', JSON.stringify(summaries, null, 2))
  if (ext.some(e => e.extname === 'pg_net')) {
    const responses = await db.$queryRawUnsafe('select id::text, status_code, timed_out, error_msg, created from net._http_response order by created desc limit 12')
    console.log('HTTP outcomes', JSON.stringify(responses.map(r => ({ ...r, error_msg: scrub(r.error_msg) })), null, 2))
  }
}
main().catch(e => { console.error(scrub(e.message)); process.exitCode = 1 }).finally(() => db.$disconnect())
