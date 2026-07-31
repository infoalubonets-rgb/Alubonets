# Testing report

## Automated coverage (Stage 9)

| Layer | Tool | What |
|-------|------|------|
| Unit | Vitest (`npm test`) | Supabase URL normalize, settings validation, loan outstanding math, nav/pagination helpers |
| CI | `.github/workflows/ci.yml` | typecheck, vitest, prisma validate |
| E2E | Playwright (`npm run test:e2e`) | Unauthenticated redirects; member contributions + welfare; admin approvals/settings (needs seeded Auth) |

## Running e2e locally

```bash
# App running on :3001 with seeded Auth users
set E2E_RUN=1
npm run test:e2e
```

Optional overrides: `E2E_MEMBER_EMAIL`, `E2E_MEMBER_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `PLAYWRIGHT_BASE_URL`.

CI e2e job runs only when repository variable `E2E_ENABLED=true` and secrets are set.

## Authorization matrix (smoke)

| Route | Unauthenticated | Expected |
|-------|-----------------|----------|
| `/admin` | yes | redirect login |
| `/dashboard/treasurer` | yes | redirect login |

Role boundaries are enforced via `requireActiveRole` / `requireAdmin` in server actions and pages.

## Manual acceptance (a11y / mobile)

- [ ] Keyboard: tab through login, member nav, welfare form submit
- [ ] Mobile width: member home, contributions, documents list
- [ ] Screen reader: pagination links have clear labels

## Restore drill

Record results in `docs/BACKUP_AND_RECOVERY.md` restore template after a non-prod restore.
