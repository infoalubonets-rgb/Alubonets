require('@next/env').loadEnvConfig(process.cwd())
async function main() {
  console.log(JSON.stringify({ localCronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()), localCronSecretIsPlaceholder: process.env.CRON_SECRET === 'change-me-to-a-long-random-string', localCronBaseOverrideConfigured: Boolean(process.env.CRON_BASE_URL) }))
  const base = process.env.CRON_BASE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (base && !/localhost|127\.0\.0\.1/.test(base)) {
    const origin = new URL(base).origin
    console.log('Configured deployment: ' + origin)
    for (const path of ['/api/cron/stage4-maintenance', '/api/cron/purge-audit']) {
      try {
        const r = await fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(20000) })
        const text = await r.text()
        console.log(JSON.stringify({ endpoint: path, status: r.status, response: text.startsWith('{') ? text.slice(0, 250) : 'Non-JSON response' }))
      } catch (e) { console.log(path + ': ' + e.message) }
    }
  }
  const r = await fetch('https://api.github.com/repos/vouh/Alubonets/actions/workflows/cron.yml/runs?per_page=5', { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) })
  console.log('Public GitHub runs API status: ' + r.status)
  if (r.ok) {
    const data = await r.json()
    console.log(JSON.stringify(data.workflow_runs.map(run => ({ id: run.id, status: run.status, conclusion: run.conclusion, created: run.created_at, url: run.html_url })), null, 2))
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1 })
