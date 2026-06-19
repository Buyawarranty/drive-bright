
-- abandoned_cart_emails
DROP POLICY IF EXISTS "Service role can manage abandoned cart emails" ON public.abandoned_cart_emails;

-- admin_config
DROP POLICY IF EXISTS "Service role can manage config" ON public.admin_config;

-- admin_invitations
DROP POLICY IF EXISTS "Service role can manage invitations" ON public.admin_invitations;

-- admin_notes
DROP POLICY IF EXISTS "Allow admin access to notes" ON public.admin_notes;

-- admin_users: prevent any authenticated user from listing all admin staff
DROP POLICY IF EXISTS "Authenticated users can view admin users" ON public.admin_users;

-- agent_schedules: lock to admins
DROP POLICY IF EXISTS "Authenticated users can manage agent schedules" ON public.agent_schedules;
DROP POLICY IF EXISTS "Authenticated users can view agent schedules" ON public.agent_schedules;
CREATE POLICY "Admins can manage agent schedules"
  ON public.agent_schedules FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- bumper_transactions: service_role bypasses RLS, drop public policy
DROP POLICY IF EXISTS "Service can manage all bumper transactions" ON public.bumper_transactions;
CREATE POLICY "Admins can view bumper transactions"
  ON public.bumper_transactions FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- claim_quick_notes: lock to admins
DROP POLICY IF EXISTS "Authenticated users can delete claim notes" ON public.claim_quick_notes;
DROP POLICY IF EXISTS "Authenticated users can insert claim notes" ON public.claim_quick_notes;
DROP POLICY IF EXISTS "Authenticated users can update claim notes" ON public.claim_quick_notes;
DROP POLICY IF EXISTS "Authenticated users can view claim notes" ON public.claim_quick_notes;
CREATE POLICY "Admins can manage claim quick notes"
  ON public.claim_quick_notes FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- email_unsubscribes: lock to admins (edge functions use service_role)
DROP POLICY IF EXISTS "Authenticated users can delete unsubscribes" ON public.email_unsubscribes;
DROP POLICY IF EXISTS "Authenticated users can insert unsubscribes" ON public.email_unsubscribes;
DROP POLICY IF EXISTS "Authenticated users can view unsubscribes" ON public.email_unsubscribes;
CREATE POLICY "Admins can manage email unsubscribes"
  ON public.email_unsubscribes FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- landing_pages: keep public SELECT (SEO), restrict writes to admins
DROP POLICY IF EXISTS "Admins can create landing pages" ON public.landing_pages;
DROP POLICY IF EXISTS "Admins can delete landing pages" ON public.landing_pages;
DROP POLICY IF EXISTS "Admins can update landing pages" ON public.landing_pages;
CREATE POLICY "Admins can insert landing pages"
  ON public.landing_pages FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update landing pages"
  ON public.landing_pages FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete landing pages"
  ON public.landing_pages FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- lead_access_requests: restrict UPDATE to admins / sales leads
DROP POLICY IF EXISTS "Anyone authenticated can update access requests" ON public.lead_access_requests;
DROP POLICY IF EXISTS "Anyone authenticated can view access requests" ON public.lead_access_requests;
CREATE POLICY "Admins and sales leads can view access requests"
  ON public.lead_access_requests FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_sales_lead(auth.uid()));
CREATE POLICY "Admins and sales leads can update access requests"
  ON public.lead_access_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_sales_lead(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_sales_lead(auth.uid()));

-- lead_reminders: scope to admin staff (user_id is the admin who owns it)
DROP POLICY IF EXISTS "Users can create reminders" ON public.lead_reminders;
DROP POLICY IF EXISTS "Users can delete their own reminders" ON public.lead_reminders;
DROP POLICY IF EXISTS "Users can update their own reminders" ON public.lead_reminders;
DROP POLICY IF EXISTS "Users can view their own reminders" ON public.lead_reminders;
CREATE POLICY "Admins can view lead reminders"
  ON public.lead_reminders FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_sales_lead(auth.uid()));
CREATE POLICY "Admins can insert lead reminders"
  ON public.lead_reminders FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_sales_lead(auth.uid()));
CREATE POLICY "Admins can update lead reminders"
  ON public.lead_reminders FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_sales_lead(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_sales_lead(auth.uid()));
CREATE POLICY "Admins can delete lead reminders"
  ON public.lead_reminders FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_sales_lead(auth.uid()));

-- overflow_round_robin_state: keep the routing-manager policy, drop the open ones
DROP POLICY IF EXISTS "Allow admin manage overflow_rr_state" ON public.overflow_round_robin_state;
DROP POLICY IF EXISTS "Allow authenticated read overflow_rr_state" ON public.overflow_round_robin_state;

-- permission_policies
DROP POLICY IF EXISTS "Service role can manage permission policies" ON public.permission_policies;

-- quote_detail_issues: keep public INSERT, lock SELECT/UPDATE to admins
DROP POLICY IF EXISTS "Authenticated users can read detail issues" ON public.quote_detail_issues;
DROP POLICY IF EXISTS "Authenticated users can update detail issues" ON public.quote_detail_issues;
CREATE POLICY "Admins can read detail issues"
  ON public.quote_detail_issues FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update detail issues"
  ON public.quote_detail_issues FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- sales_leads_changelog: restrict SELECT to admins / sales leads
DROP POLICY IF EXISTS "Admin users can read changelog" ON public.sales_leads_changelog;
CREATE POLICY "Admins and sales leads can read changelog"
  ON public.sales_leads_changelog FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_sales_lead(auth.uid()));

-- sms_consents: keep anon INSERT (webhook), lock SELECT/UPDATE to admins
DROP POLICY IF EXISTS "Allow anon select for webhook" ON public.sms_consents;
DROP POLICY IF EXISTS "Allow anon update for webhook" ON public.sms_consents;
CREATE POLICY "Admins can view sms consents"
  ON public.sms_consents FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update sms consents"
  ON public.sms_consents FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- warranty_selection_audit: service_role bypasses RLS, drop public policy
DROP POLICY IF EXISTS "Service role can manage warranty audit" ON public.warranty_selection_audit;

-- warranty_serials: service_role bypasses RLS, drop public policy
DROP POLICY IF EXISTS "Service role can manage warranty serials" ON public.warranty_serials;

-- welcome_emails: contains plaintext passwords — service_role only
DROP POLICY IF EXISTS "Service role can manage welcome emails" ON public.welcome_emails;
