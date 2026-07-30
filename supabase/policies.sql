-- Alubonets RLS policies
-- Prisma columns are camelCase (quoted). Apply in Supabase SQL Editor after schema push.
-- Service role / Prisma bypasses RLS.
-- Prefer JWT app_metadata claims; fall back to users table via auth.uid().
--
-- Supabase "Potential issue detected / destructive operations" warning:
-- Expected. This script uses DROP POLICY IF EXISTS / CREATE OR REPLACE / ALTER TABLE.
-- Those only replace RLS policies (and optional check constraints) — they do NOT drop
-- your users/contributions data. Review once, then confirm Run if you intend to apply.
-- Same applies to supabase/storage.sql (DROP POLICY on storage.objects only).

-- ── Helpers ──────────────────────────────────────────────────────────────────

create or replace function public.jwt_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    (select "role"::text from public.users where "authUserId" = auth.uid()::text limit 1)
  );
$$;

create or replace function public.jwt_is_super_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'isSuperAdmin')::boolean,
    (select "isSuperAdmin" from public.users where "authUserId" = auth.uid()::text limit 1),
    false
  );
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.jwt_app_role();
$$;

create or replace function public.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where "authUserId" = auth.uid()::text limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.jwt_is_super_admin();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or public.current_app_role() = 'ADMIN';
$$;

create or replace function public.is_treasurer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.current_app_role() = 'TREASURER';
$$;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where "authUserId" = auth.uid()::text and status = 'ACTIVE'
  )
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'status', '') = 'ACTIVE';
$$;

-- True if primary role or dashboardAccess array includes the role (or Super Admin).
create or replace function public.has_dashboard(target_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or public.current_app_role() = target_role
    or exists (
      select 1
      from public.users u
      where u."authUserId" = auth.uid()::text
        and target_role = any (u."dashboardAccess"::text[])
    )
    or exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(auth.jwt() -> 'app_metadata' -> 'dashboardAccess', '[]'::jsonb)
      ) as d(role)
      where d.role = target_role
    );
$$;

-- ── Enable RLS ───────────────────────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.contributions enable row level security;
alter table public.welfare_requests enable row level security;
alter table public.projects enable row level security;
alter table public.gallery_photos enable row level security;
alter table public.announcements enable row level security;
alter table public.events enable row level security;
alter table public.documents enable row level security;
alter table public.meetings enable row level security;
alter table public.email_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.contact_submissions enable row level security;
alter table public.member_profiles enable row level security;
alter table public.consent_records enable row level security;
alter table public.login_events enable row level security;
alter table public.rate_limits enable row level security;
alter table public.membership_sequences enable row level security;

-- ── users ────────────────────────────────────────────────────────────────────

drop policy if exists users_select_self_or_staff on public.users;
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated
  using (
    "authUserId" = auth.uid()::text
    or public.is_admin()
  );

drop policy if exists users_update_admin on public.users;
drop policy if exists users_update on public.users;
create policy users_update on public.users
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists users_insert on public.users;
create policy users_insert on public.users
  for insert to authenticated
  with check (public.is_admin() or "authUserId" = auth.uid()::text);

drop policy if exists users_delete on public.users;
create policy users_delete on public.users
  for delete to authenticated
  using (public.is_super_admin());

-- Sensitive member profiles are visible only to the member and administrators.
drop policy if exists member_profiles_select on public.member_profiles;
create policy member_profiles_select on public.member_profiles
  for select to authenticated
  using ("userId" = public.current_app_user_id() or public.is_admin());

drop policy if exists member_profiles_update on public.member_profiles;
create policy member_profiles_update on public.member_profiles
  for update to authenticated
  using ("userId" = public.current_app_user_id() or public.is_admin())
  with check ("userId" = public.current_app_user_id() or public.is_admin());

drop policy if exists consent_records_select on public.consent_records;
create policy consent_records_select on public.consent_records
  for select to authenticated
  using ("userId" = public.current_app_user_id() or public.is_admin());

drop policy if exists login_events_select on public.login_events;
create policy login_events_select on public.login_events
  for select to authenticated
  using ("userId" = public.current_app_user_id() or public.is_admin());

-- ── contributions ────────────────────────────────────────────────────────────

drop policy if exists contributions_select on public.contributions;
create policy contributions_select on public.contributions
  for select to authenticated
  using (
    "userId" = public.current_app_user_id()
    or public.is_treasurer()
    or public.current_app_role() = 'EXECUTIVE'
    or public.has_dashboard('TREASURER')
  );

drop policy if exists contributions_write_finance on public.contributions;
drop policy if exists contributions_insert on public.contributions;
create policy contributions_insert on public.contributions
  for insert to authenticated
  with check (public.is_treasurer() or public.has_dashboard('TREASURER'));

drop policy if exists contributions_update on public.contributions;
create policy contributions_update on public.contributions
  for update to authenticated
  using (public.is_treasurer())
  with check (public.is_treasurer());

drop policy if exists contributions_delete on public.contributions;
create policy contributions_delete on public.contributions
  for delete to authenticated
  using (public.is_admin());

-- Optional integrity: amount must be positive
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contributions_amount_positive'
  ) then
    alter table public.contributions
      add constraint contributions_amount_positive check (amount > 0);
  end if;
exception when others then
  raise notice 'contributions_amount_positive skipped: %', sqlerrm;
end $$;

-- ── welfare_requests ─────────────────────────────────────────────────────────

drop policy if exists welfare_select on public.welfare_requests;
create policy welfare_select on public.welfare_requests
  for select to authenticated
  using (
    "userId" = public.current_app_user_id()
    or public.is_treasurer()
    or public.current_app_role() = 'EXECUTIVE'
  );

drop policy if exists welfare_insert_own on public.welfare_requests;
create policy welfare_insert_own on public.welfare_requests
  for insert to authenticated
  with check ("userId" = public.current_app_user_id() and public.is_active_member());

drop policy if exists welfare_update_staff on public.welfare_requests;
create policy welfare_update_staff on public.welfare_requests
  for update to authenticated
  using (public.is_treasurer())
  with check (public.is_treasurer());

drop policy if exists welfare_delete on public.welfare_requests;
create policy welfare_delete on public.welfare_requests
  for delete to authenticated
  using (public.is_admin());

-- ── projects ─────────────────────────────────────────────────────────────────

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (public.is_active_member());

drop policy if exists projects_public_read on public.projects;
create policy projects_public_read on public.projects
  for select to anon using (true);

drop policy if exists projects_write_staff on public.projects;
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (
    public.is_admin()
    or public.current_app_role() in ('EXECUTIVE', 'ORGANIZER')
    or public.has_dashboard('ORGANIZER')
  );

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (
    public.is_admin()
    or public.current_app_role() in ('EXECUTIVE', 'ORGANIZER')
  )
  with check (
    public.is_admin()
    or public.current_app_role() in ('EXECUTIVE', 'ORGANIZER')
  );

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using (public.is_admin() or public.current_app_role() = 'EXECUTIVE');

-- ── events ───────────────────────────────────────────────────────────────────

drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated using (public.is_active_member());

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select to anon using ("isPublic" = true);

drop policy if exists events_write on public.events;
drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert to authenticated
  with check (
    public.is_admin()
    or public.current_app_role() in ('ORGANIZER', 'SECRETARY')
  );

drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update to authenticated
  using (public.is_admin() or public.current_app_role() in ('ORGANIZER', 'SECRETARY'))
  with check (public.is_admin() or public.current_app_role() in ('ORGANIZER', 'SECRETARY'));

drop policy if exists events_delete on public.events;
create policy events_delete on public.events
  for delete to authenticated
  using (public.is_admin());

-- ── announcements ────────────────────────────────────────────────────────────

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated using (public.is_active_member());

drop policy if exists announcements_write on public.announcements;
drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (
    public.is_admin()
    or public.current_app_role() in ('SECRETARY', 'EXECUTIVE')
  );

drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements
  for update to authenticated
  using (public.is_admin() or public.current_app_role() in ('SECRETARY', 'EXECUTIVE'))
  with check (public.is_admin() or public.current_app_role() in ('SECRETARY', 'EXECUTIVE'));

drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements
  for delete to authenticated
  using (public.is_admin() or public.current_app_role() = 'SECRETARY');

-- ── gallery_photos ───────────────────────────────────────────────────────────

drop policy if exists gallery_public_read on public.gallery_photos;
create policy gallery_public_read on public.gallery_photos
  for select to anon, authenticated using ("isPublic" = true);

drop policy if exists gallery_staff_read_all on public.gallery_photos;
create policy gallery_staff_read_all on public.gallery_photos
  for select to authenticated
  using (public.is_admin() or public.current_app_role() = 'ORGANIZER');

drop policy if exists gallery_insert on public.gallery_photos;
create policy gallery_insert on public.gallery_photos
  for insert to authenticated
  with check (
    public.is_admin()
    or public.current_app_role() = 'ORGANIZER'
    or public.is_active_member()
  );

drop policy if exists gallery_approve on public.gallery_photos;
create policy gallery_approve on public.gallery_photos
  for update to authenticated
  using (public.is_admin() or public.current_app_role() = 'ORGANIZER')
  with check (public.is_admin() or public.current_app_role() = 'ORGANIZER');

drop policy if exists gallery_delete on public.gallery_photos;
create policy gallery_delete on public.gallery_photos
  for delete to authenticated
  using (public.is_admin() or public.current_app_role() = 'ORGANIZER');

-- ── documents ────────────────────────────────────────────────────────────────

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to authenticated using (public.is_active_member());

drop policy if exists documents_write on public.documents;
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents
  for insert to authenticated
  with check (public.is_admin() or public.current_app_role() = 'SECRETARY');

drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents
  for update to authenticated
  using (public.is_admin() or public.current_app_role() = 'SECRETARY')
  with check (public.is_admin() or public.current_app_role() = 'SECRETARY');

drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents
  for delete to authenticated
  using (public.is_admin());

-- ── meetings ─────────────────────────────────────────────────────────────────

drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select to authenticated using (public.is_active_member());

drop policy if exists meetings_write on public.meetings;
drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert on public.meetings
  for insert to authenticated
  with check (public.is_admin() or public.current_app_role() = 'SECRETARY');

drop policy if exists meetings_update on public.meetings;
create policy meetings_update on public.meetings
  for update to authenticated
  using (public.is_admin() or public.current_app_role() = 'SECRETARY')
  with check (public.is_admin() or public.current_app_role() = 'SECRETARY');

drop policy if exists meetings_delete on public.meetings;
create policy meetings_delete on public.meetings
  for delete to authenticated
  using (public.is_admin());

-- ── audit_logs / email_logs ──────────────────────────────────────────────────

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs
  for select to authenticated
  using (public.is_admin() or public.current_app_role() = 'EXECUTIVE');

drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs
  for insert to authenticated
  with check (public.is_active_member());

drop policy if exists email_select on public.email_logs;
create policy email_select on public.email_logs
  for select to authenticated
  using (public.is_admin());

-- ── Realtime publication (run once; ignore if already added) ─────────────────

do $$
begin
  alter publication supabase_realtime add table public.announcements;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.welfare_requests;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.contributions;
exception when duplicate_object then null;
end $$;
