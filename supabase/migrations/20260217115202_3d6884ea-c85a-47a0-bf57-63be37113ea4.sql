-- Allow all active sales agents to see other admin users (needed to display agent names on leads)
CREATE POLICY "Sales users can view all admin users"
  ON public.admin_users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND au.role IN ('sales', 'sales_lead')
    )
  );