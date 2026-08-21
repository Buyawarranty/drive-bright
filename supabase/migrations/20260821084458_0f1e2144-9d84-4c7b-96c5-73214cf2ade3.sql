ALTER POLICY "Agents can read own assignment changelog"
ON public.sales_leads_changelog
USING (
  old_assigned_to = ANY (
    ARRAY( SELECT au.id FROM public.admin_users au
            WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = true )
  )
  OR new_assigned_to = ANY (
    ARRAY( SELECT au.id FROM public.admin_users au
            WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = true )
  )
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id_active
  ON public.admin_users (user_id) WHERE is_active = true;
