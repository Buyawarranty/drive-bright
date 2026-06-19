
-- welcome_emails currently has RLS enabled but no policies,
-- which silently blocks the admin dashboard from loading customer credentials.

CREATE POLICY "Staff can view welcome emails"
  ON public.welcome_emails
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_sales(auth.uid()));

CREATE POLICY "Staff can insert welcome emails"
  ON public.welcome_emails
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_sales(auth.uid()));

CREATE POLICY "Staff can update welcome emails"
  ON public.welcome_emails
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_sales(auth.uid()))
  WITH CHECK (public.is_admin_or_sales(auth.uid()));

CREATE POLICY "Customers can view own welcome email"
  ON public.welcome_emails
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(auth.email()));

CREATE POLICY "Service role manages welcome emails"
  ON public.welcome_emails
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.welcome_emails TO authenticated;
GRANT ALL ON public.welcome_emails TO service_role;
