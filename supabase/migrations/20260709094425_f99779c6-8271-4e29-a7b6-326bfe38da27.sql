DROP POLICY IF EXISTS "Admins can manage claim quick notes" ON public.claim_quick_notes;

CREATE POLICY "Staff can manage claim quick notes"
  ON public.claim_quick_notes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role::text IN ('admin','super_admin','dev_tester','sales_manager','performance_manager','sales_lead','sales','sales_agent','claims_agent','accounts_manager','lead_gen')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role::text IN ('admin','super_admin','dev_tester','sales_manager','performance_manager','sales_lead','sales','sales_agent','claims_agent','accounts_manager','lead_gen')
    )
  );