# Deployment checklist

## Before deploy
- [ ] `npm run typecheck` and `npm test` pass
- [ ] `npx prisma migrate deploy` on target DB
- [ ] Env vars set (see `docs/ENVIRONMENTS.md`): Database, Supabase, Resend, M-Pesa as needed, `CRON_SECRET`, `SENTRY_DSN`
- [ ] Feature flags reviewed (`loans_enabled` default off)
- [ ] Seed/bootstrap **not** run against production

## After deploy
- [ ] `GET /api/health` returns ok
- [ ] Admin login works
- [ ] Member login works
- [ ] Contribution / ledger smoke
- [ ] Document download smoke
- [ ] Cron endpoints protected (Bearer secret)

## Monitoring
- [ ] Sentry receiving events (see `docs/MONITORING_AND_SENTRY.md`)
- [ ] External uptime check on `/api/health`
