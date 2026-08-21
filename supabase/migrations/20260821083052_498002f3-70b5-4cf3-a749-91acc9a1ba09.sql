-- sales_leads: wrap auth.uid() so the access check is evaluated once per query
DROP POLICY IF EXISTS "Admins can manage all leads" ON public.sales_leads;
CREATE POLICY "Admins can manage all leads"
  ON public.sales_leads FOR ALL TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Sales leads can update all leads" ON public.sales_leads;
CREATE POLICY "Sales leads can update all leads"
  ON public.sales_leads FOR UPDATE TO authenticated
  USING (public.is_sales_lead((SELECT auth.uid())));

DROP POLICY IF EXISTS "Active admin users can update all leads" ON public.sales_leads;
CREATE POLICY "Active admin users can update all leads"
  ON public.sales_leads FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = true));

DROP POLICY IF EXISTS "Sales users can delete assigned leads" ON public.sales_leads;
CREATE POLICY "Sales users can delete assigned leads"
  ON public.sales_leads FOR DELETE TO authenticated
  USING (
    assigned_to IN (SELECT au.id FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid()))
    OR public.is_admin((SELECT auth.uid()))
  );

-- claims_submissions: same per-row -> per-query fix
DROP POLICY IF EXISTS "Staff with claims access can manage claims submissions" ON public.claims_submissions;
CREATE POLICY "Staff with claims access can manage claims submissions"
  ON public.claims_submissions FOR ALL TO authenticated
  USING (public.has_tab_access((SELECT auth.uid()), 'claims'));

DROP POLICY IF EXISTS "Admins can view monthly stats" ON public.claims_submissions;
CREATE POLICY "Admins can view monthly stats"
  ON public.claims_submissions FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Customers can view their own claims" ON public.claims_submissions;
CREATE POLICY "Customers can view their own claims"
  ON public.claims_submissions FOR SELECT TO authenticated
  USING (lower(email) = lower(((SELECT auth.jwt()) ->> 'email')));