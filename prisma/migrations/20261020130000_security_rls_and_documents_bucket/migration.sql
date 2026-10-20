-- Security hardening. Safe to re-run.
--
-- 1. Row Level Security on every table in the public schema. The site reads and writes through
--    Prisma as the table owner (and server code uses the service role), both of which bypass RLS,
--    so the app is unaffected. What it closes: Supabase's public REST API, reachable with the
--    browser's public key, can no longer read tables that had no RLS (setup tokens, loans,
--    support messages, …). Tables that already have policies keep them.
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

-- 2. Private documents bucket: members no longer list or download every file directly from
--    Supabase Storage (which exposed other members' loan evidence and role-restricted
--    documents). The site hands out short-lived signed links after its own permission checks,
--    so only administrators and the secretary keep direct read access.
--    Storage policies need rights some projects do not grant to the migration role; if so this
--    step is skipped with a notice (apply supabase/storage.sql in the SQL Editor instead) and the
--    rest of the migration still succeeds.
DO $$
BEGIN
  DROP POLICY IF EXISTS documents_storage_read ON storage.objects;
  CREATE POLICY documents_storage_read ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'documents' AND (public.is_admin() OR public.current_app_role() = 'SECRETARY'));
EXCEPTION
  WHEN insufficient_privilege OR undefined_function OR undefined_table THEN
    RAISE NOTICE 'Skipped documents bucket policy (%). Apply supabase/storage.sql in the SQL Editor.', SQLERRM;
END $$;
