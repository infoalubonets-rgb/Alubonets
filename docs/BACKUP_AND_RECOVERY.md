# Backup and recovery

## Database

Alubonets relies on Supabase-managed PostgreSQL backups. Before live launch, an administrator must verify in the Supabase dashboard:

1. The production plan's backup frequency and retention.
2. Whether point-in-time recovery is enabled.
3. Who is authorized to initiate restoration.
4. How long a restoration normally takes.
5. How restoration affects Auth, database and API availability.

Record a quarterly restore test in a non-production Supabase project. A backup is not considered verified until restoration has been demonstrated.

## Supabase Auth

Auth identities are managed by Supabase. Application profiles remain in `public.users`. After a database restore, verify that `users.authUserId` values still correspond to Supabase Auth users.

## Storage

Database backups do not automatically prove that uploaded files in Supabase Storage can be recovered. Maintain a scheduled export or provider-supported backup for the `gallery` and `documents` buckets before relying on the platform for irreplaceable records.

## Recovery checklist

1. Stop application writes.
2. Record the incident time and last known good time.
3. Export current database/storage state where possible.
4. Restore into a temporary project first.
5. Validate member counts, financial totals, Auth links and file access.
6. Approve the recovery with the designated production owner.
7. Restore production.
8. Run `/api/health`, login, contribution, meeting and document checks.
9. Record the recovery in the audit/incident log.

## Restore drill record (fill after each non-prod exercise)

| Field | Value |
|-------|--------|
| Date | |
| Operator | |
| Source project / backup id | |
| Target scratch project | |
| Duration | |
| Member count check | Pass / Fail |
| Auth `authUserId` link check | Pass / Fail |
| Storage sample file check | Pass / Fail |
| Notes | |
| Sign-off | |

