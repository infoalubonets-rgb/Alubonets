# Environment strategy

## Current state

- Local development runs at `http://localhost:3001`.
- Netlify is the current testing host.
- Vercel is the intended future production host.
- The currently connected Supabase project contains real production data.

Because Netlify testing currently touches production data, testing must avoid destructive fixtures, bulk deletion, password resets and schema experiments. The recommended next infrastructure step is a separate Supabase project for development/staging.

## Required separation

| Environment | Hosting | Database | Purpose |
|---|---|---|---|
| Local | Developer machine | Separate development Supabase project recommended | Feature development |
| Testing | Netlify | Separate staging Supabase project recommended | Committee acceptance |
| Production | Vercel | Current production Supabase project | Live member use |

Until separate Supabase projects exist, changes must be backward-compatible, additive and reviewed before being run.

## Environment variables

Use `.env.local` locally. It is Git-ignored. Configure equivalent values in Netlify deploy contexts and later in Vercel.

Never place `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, provider secrets or API secrets in browser code.

Run `npm run prebuild` to validate required configuration before deployment.

## Deployment flow

1. Create a feature branch.
2. Run `npm run check`.
3. Review generated Prisma migration SQL.
4. Test on a separate staging Supabase project when available.
5. Merge to `main`.
6. Run `npm run db:migrate:deploy` against the intended database.
7. Deploy the saved commit.
8. Verify `/api/health` and critical login/dashboard paths.
9. Record the deployed commit and migration in the release notes.
