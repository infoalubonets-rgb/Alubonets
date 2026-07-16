-- Alubonets RLS policies (Prisma column names are camelCase unless noted).
-- Apply in Supabase SQL Editor after schema push.
-- Service role / Prisma bypass RLS.

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select "role"::text from public.users where "authUserId" = auth.uid()::text limit 1;
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
  );
$$;

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

drop policy if exists users_select_self_or_staff on public.users;
create policy users_select_self_or_staff on public.users
  for select to authenticated
  using (
    "authUserId" = auth.uid()::text
    or public.current_app_role() in ('ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY')
  );

drop policy if exists users_update_admin on public.users;
create policy users_update_admin on public.users
  for update to authenticated
  using (public.current_app_role() = 'ADMIN')
  with check (public.current_app_role() = 'ADMIN');

drop policy if exists contributions_select on public.contributions;
create policy contributions_select on public.contributions
  for select to authenticated
  using (
    "userId" = public.current_app_user_id()
    or public.current_app_role() in ('ADMIN', 'EXECUTIVE', 'TREASURER')
  );

drop policy if exists contributions_write_finance on public.contributions;
create policy contributions_write_finance on public.contributions
  for all to authenticated
  using (public.current_app_role() in ('ADMIN', 'TREASURER'))
  with check (public.current_app_role() in ('ADMIN', 'TREASURER'));

drop policy if exists welfare_select on public.welfare_requests;
create policy welfare_select on public.welfare_requests
  for select to authenticated
  using (
    "userId" = public.current_app_user_id()
    or public.current_app_role() in ('ADMIN', 'EXECUTIVE', 'TREASURER')
  );

drop policy if exists welfare_insert_own on public.welfare_requests;
create policy welfare_insert_own on public.welfare_requests
  for insert to authenticated
  with check ("userId" = public.current_app_user_id() and public.is_active_member());

drop policy if exists welfare_update_staff on public.welfare_requests;
create policy welfare_update_staff on public.welfare_requests
  for update to authenticated
  using (public.current_app_role() in ('ADMIN', 'TREASURER'))
  with check (public.current_app_role() in ('ADMIN', 'TREASURER'));

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated using (public.is_active_member());

drop policy if exists projects_public_read on public.projects;
create policy projects_public_read on public.projects
  for select to anon using (true);

drop policy if exists projects_write_staff on public.projects;
create policy projects_write_staff on public.projects
  for all to authenticated
  using (public.current_app_role() in ('ADMIN', 'EXECUTIVE', 'ORGANIZER'))
  with check (public.current_app_role() in ('ADMIN', 'EXECUTIVE', 'ORGANIZER'));

drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated using (public.is_active_member());

drop policy if exists events_write on public.events;
create policy events_write on public.events
  for all to authenticated
  using (public.current_app_role() in ('ADMIN', 'ORGANIZER', 'SECRETARY'))
  with check (public.current_app_role() in ('ADMIN', 'ORGANIZER', 'SECRETARY'));

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated using (public.is_active_member());

drop policy if exists announcements_write on public.announcements;
create policy announcements_write on public.announcements
  for all to authenticated
  using (public.current_app_role() in ('ADMIN', 'SECRETARY', 'EXECUTIVE'))
  with check (public.current_app_role() in ('ADMIN', 'SECRETARY', 'EXECUTIVE'));

drop policy if exists gallery_public_read on public.gallery_photos;
create policy gallery_public_read on public.gallery_photos
  for select to anon, authenticated using ("isPublic" = true);

drop policy if exists gallery_staff_read_all on public.gallery_photos;
create policy gallery_staff_read_all on public.gallery_photos
  for select to authenticated
  using (public.current_app_role() in ('ADMIN', 'ORGANIZER'));

drop policy if exists gallery_insert on public.gallery_photos;
create policy gallery_insert on public.gallery_photos
  for insert to authenticated
  with check (public.current_app_role() in ('ADMIN', 'ORGANIZER') or public.is_active_member());

drop policy if exists gallery_approve on public.gallery_photos;
create policy gallery_approve on public.gallery_photos
  for update to authenticated
  using (public.current_app_role() in ('ADMIN', 'ORGANIZER'))
  with check (public.current_app_role() in ('ADMIN', 'ORGANIZER'));

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to authenticated using (public.is_active_member());

drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents
  for all to authenticated
  using (public.current_app_role() in ('ADMIN', 'SECRETARY'))
  with check (public.current_app_role() in ('ADMIN', 'SECRETARY'));

drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select to authenticated using (public.is_active_member());

drop policy if exists meetings_write on public.meetings;
create policy meetings_write on public.meetings
  for all to authenticated
  using (public.current_app_role() in ('ADMIN', 'SECRETARY'))
  with check (public.current_app_role() in ('ADMIN', 'SECRETARY'));

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs
  for select to authenticated
  using (public.current_app_role() in ('ADMIN', 'EXECUTIVE'));

drop policy if exists email_select on public.email_logs;
create policy email_select on public.email_logs
  for select to authenticated
  using (public.current_app_role() = 'ADMIN');
