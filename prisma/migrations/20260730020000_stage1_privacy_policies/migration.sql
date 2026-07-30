ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING ("authUserId" = auth.uid()::text OR public.is_admin());

DROP POLICY IF EXISTS member_profiles_select ON public.member_profiles;
CREATE POLICY member_profiles_select ON public.member_profiles
  FOR SELECT TO authenticated
  USING ("userId" = public.current_app_user_id() OR public.is_admin());

DROP POLICY IF EXISTS member_profiles_update ON public.member_profiles;
CREATE POLICY member_profiles_update ON public.member_profiles
  FOR UPDATE TO authenticated
  USING ("userId" = public.current_app_user_id() OR public.is_admin())
  WITH CHECK ("userId" = public.current_app_user_id() OR public.is_admin());

DROP POLICY IF EXISTS consent_records_select ON public.consent_records;
CREATE POLICY consent_records_select ON public.consent_records
  FOR SELECT TO authenticated
  USING ("userId" = public.current_app_user_id() OR public.is_admin());

DROP POLICY IF EXISTS login_events_select ON public.login_events;
CREATE POLICY login_events_select ON public.login_events
  FOR SELECT TO authenticated
  USING ("userId" = public.current_app_user_id() OR public.is_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('member-avatars', 'member-avatars', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS member_avatars_read ON storage.objects;
CREATE POLICY member_avatars_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'member-avatars' AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text));
DROP POLICY IF EXISTS member_avatars_insert ON storage.objects;
CREATE POLICY member_avatars_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'member-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS member_avatars_update ON storage.objects;
CREATE POLICY member_avatars_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'member-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'member-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS member_avatars_delete ON storage.objects;
CREATE POLICY member_avatars_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'member-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
