async function main() {
  const headers = { Accept: 'application/vnd.github+json' }
  const r = await fetch('https://api.github.com/repos/vouh/Alubonets/actions/runs/38140091899/jobs', { headers })
  console.log('Jobs API: ' + r.status)
  if (r.ok) {
    const data = await r.json()
    for (const job of data.jobs) {
      console.log(JSON.stringify({ name: job.name, conclusion: job.conclusion, steps: job.steps.map(s => ({ name: s.name, conclusion: s.conclusion })), check: job.check_run_url }))
      const a = await fetch(job.check_run_url + '/annotations', { headers })
      console.log('Annotations API: ' + a.status)
      if (a.ok) console.log(JSON.stringify((await a.json()).map(a => ({ title: a.title, message: a.message }))))
    }
  }
  for (const path of ['/api/cron/stage4-maintenance', '/api/cron/purge-audit']) {
    const r = await fetch('https://alubonets.netlify.app' + path + '?diagnostic=' + Date.now(), { redirect: 'manual', signal: AbortSignal.timeout(25000) })
    const text = await r.text()
    console.log(JSON.stringify({ path, status: r.status, response: text.startsWith('{') ? text.slice(0, 250) : 'Non-JSON response' }))
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1 })
