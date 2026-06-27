DROP POLICY IF EXISTS "renewal_offers_manage_admins" ON public.renewal_offers;
CREATE POLICY "renewal_offers_manage_admins" ON public.renewal_offers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND au.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'sales_lead'::user_role, 'sales_manager'::user_role, 'performance_manager'::user_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND au.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'sales_lead'::user_role, 'sales_manager'::user_role, 'performance_manager'::user_role])
    )
  );

DROP POLICY IF EXISTS "Admins can manage settings" ON public.lead_settings;
CREATE POLICY "Admins can manage settings" ON public.lead_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND au.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role, 'sales_manager'::user_role, 'performance_manager'::user_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND au.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role, 'sales_manager'::user_role, 'performance_manager'::user_role])
    )
  );

DROP POLICY IF EXISTS "Management can view all team visibility" ON public.sales_lead_team_visibility;
CREATE POLICY "Management can view all team visibility" ON public.sales_lead_team_visibility
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'sales_manager'::user_role, 'performance_manager'::user_role])
        AND admin_users.is_active = true
    )
  );

DROP POLICY IF EXISTS "Management can manage team visibility" ON public.sales_lead_team_visibility;
CREATE POLICY "Management can manage team visibility" ON public.sales_lead_team_visibility
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'sales_manager'::user_role, 'performance_manager'::user_role])
        AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'sales_manager'::user_role, 'performance_manager'::user_role])
        AND admin_users.is_active = true
    )
  );