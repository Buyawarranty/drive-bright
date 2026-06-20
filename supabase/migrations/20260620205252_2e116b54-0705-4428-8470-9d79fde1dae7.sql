
DROP POLICY IF EXISTS "Only admins can update settings" ON public.lead_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.lead_settings;

CREATE POLICY "Admins can manage settings"
  ON public.lead_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND au.role IN ('super_admin','admin','sales_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND au.role IN ('super_admin','admin','sales_manager')
    )
  );
