-- Storage buckets + policies for Alubonets
-- Run in Supabase SQL Editor after policies.sql
--
-- Supabase may warn about "destructive operations" because of DROP POLICY IF EXISTS.
-- That only replaces storage access rules — it does not delete files already in buckets.
-- Confirm Run if you intend to apply these policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'gallery',
    'gallery',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    -- event cover images are stored under the event-covers/ prefix in this bucket
  ),
  (
    'documents',
    'documents',
    false,
    5242880,
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ]
  ),
  (
    'member-avatars',
    'member-avatars',
    false,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Gallery: public read; staff / active members can upload
drop policy if exists gallery_storage_public_read on storage.objects;
create policy gallery_storage_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'gallery');

drop policy if exists gallery_storage_upload on storage.objects;
create policy gallery_storage_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gallery'
    and (
      public.is_admin()
      or public.current_app_role() = 'ORGANIZER'
      or public.is_active_member()
    )
  );

drop policy if exists gallery_storage_update on storage.objects;
create policy gallery_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'gallery' and (public.is_admin() or public.current_app_role() = 'ORGANIZER'))
  with check (bucket_id = 'gallery' and (public.is_admin() or public.current_app_role() = 'ORGANIZER'));

drop policy if exists gallery_storage_delete on storage.objects;
create policy gallery_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'gallery' and (public.is_admin() or public.current_app_role() = 'ORGANIZER'));

-- Documents: authenticated members read; secretary/admin write (use signed URLs for private access)
drop policy if exists documents_storage_read on storage.objects;
create policy documents_storage_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.is_active_member());

drop policy if exists documents_storage_upload on storage.objects;
create policy documents_storage_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (public.is_admin() or public.current_app_role() = 'SECRETARY')
  );

drop policy if exists documents_storage_update on storage.objects;
create policy documents_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (public.is_admin() or public.current_app_role() = 'SECRETARY'))
  with check (bucket_id = 'documents' and (public.is_admin() or public.current_app_role() = 'SECRETARY'));

drop policy if exists documents_storage_delete on storage.objects;
create policy documents_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin());

-- Member avatars: each member owns a folder named with their Supabase auth user ID.
-- Admins may read all avatars; members can read and manage only their own.
drop policy if exists member_avatars_read on storage.objects;
create policy member_avatars_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'member-avatars'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists member_avatars_insert on storage.objects;
create policy member_avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists member_avatars_update on storage.objects;
create policy member_avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'member-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'member-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists member_avatars_delete on storage.objects;
create policy member_avatars_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'member-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
