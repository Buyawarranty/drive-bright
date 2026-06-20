
ALTER TABLE public.staff_hub_documents
  ADD COLUMN IF NOT EXISTS allowed_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allowed_team_ids uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.can_view_staff_hub_doc(
  _allowed_roles text[],
  _allowed_team_ids uuid[]
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND (
          COALESCE(array_length(_allowed_roles, 1), 0) = 0
          OR au.role::text = ANY(_allowed_roles)
        )
        AND (
          COALESCE(array_length(_allowed_team_ids, 1), 0) = 0
          OR EXISTS (
            SELECT 1 FROM public.lead_team_members ltm
            WHERE ltm.admin_user_id = au.id
              AND ltm.team_id = ANY(_allowed_team_ids)
          )
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_staff_hub_doc(text[], uuid[]) TO authenticated;

DROP POLICY IF EXISTS "Super admins can view staff hub documents" ON public.staff_hub_documents;

CREATE POLICY "Staff can view permitted staff hub documents"
  ON public.staff_hub_documents
  FOR SELECT
  TO authenticated
  USING (public.can_view_staff_hub_doc(allowed_roles, allowed_team_ids));
