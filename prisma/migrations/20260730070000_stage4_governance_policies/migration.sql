ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_categories_member_read ON public.document_categories
  FOR SELECT TO authenticated USING (public.is_active_member());
CREATE POLICY document_downloads_own_or_admin_read ON public.document_downloads
  FOR SELECT TO authenticated USING ("userId"=public.current_app_user_id() OR public.is_admin());
CREATE POLICY meeting_invitations_own_or_staff_read ON public.meeting_invitations
  FOR SELECT TO authenticated USING ("userId"=public.current_app_user_id() OR public.current_app_role() IN ('ADMIN','SECRETARY'));
CREATE POLICY meeting_agenda_member_read ON public.meeting_agenda_items
  FOR SELECT TO authenticated USING (public.is_active_member());
CREATE POLICY meeting_actions_owner_or_staff_read ON public.meeting_action_points
  FOR SELECT TO authenticated USING ("ownerId"=public.current_app_user_id() OR public.current_app_role() IN ('ADMIN','SECRETARY'));
CREATE POLICY meeting_decisions_member_read ON public.meeting_decisions
  FOR SELECT TO authenticated USING (public.is_active_member());
CREATE POLICY meeting_versions_governance_read ON public.meeting_versions
  FOR SELECT TO authenticated USING (public.current_app_role() IN ('ADMIN','SECRETARY','EXECUTIVE'));

DROP POLICY IF EXISTS documents_authenticated_read ON public.documents;
CREATE POLICY documents_governed_read ON public.documents
  FOR SELECT TO authenticated
  USING (
    public.current_app_role() IN ('ADMIN','SECRETARY')
    OR (
      status='PUBLISHED'
      AND ("expiresAt" IS NULL OR "expiresAt">now())
      AND (
        "accessLevel" IN ('PUBLIC','MEMBERS')
        OR ("accessLevel"='SELECTED_ROLES' AND public.current_app_role()::"Role"=ANY("allowedRoles"))
      )
    )
  );

DROP POLICY IF EXISTS documents_storage_read ON storage.objects;
CREATE POLICY documents_storage_signed_read ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id='documents' AND public.is_active_member());
