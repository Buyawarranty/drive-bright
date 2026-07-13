-- Allow sales agents (not just admins/sales_lead) to manage their own lead reminders.
-- Freddie Howard and other role='sales' users were blocked from inserting into
-- lead_reminders because the existing policies only allowed is_admin or is_sales_lead.

DROP POLICY IF EXISTS "Admins can view lead reminders" ON public.lead_reminders;
DROP POLICY IF EXISTS "Admins can insert lead reminders" ON public.lead_reminders;
DROP POLICY IF EXISTS "Admins can update lead reminders" ON public.lead_reminders;
DROP POLICY IF EXISTS "Admins can delete lead reminders" ON public.lead_reminders;

CREATE POLICY "Staff can view lead reminders"
  ON public.lead_reminders FOR SELECT
  USING (
    is_admin(auth.uid())
    OR is_sales_lead(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND au.role IN ('sales','sales_manager','sales_lead','admin','super_admin')
    )
  );

CREATE POLICY "Staff can insert lead reminders"
  ON public.lead_reminders FOR INSERT
  WITH CHECK (
    is_admin(auth.uid())
    OR is_sales_lead(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND au.role IN ('sales','sales_manager','sales_lead','admin','super_admin')
    )
  );

CREATE POLICY "Staff can update lead reminders"
  ON public.lead_reminders FOR UPDATE
  USING (
    is_admin(auth.uid())
    OR is_sales_lead(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND au.role IN ('sales','sales_manager','sales_lead','admin','super_admin')
    )
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR is_sales_lead(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND au.role IN ('sales','sales_manager','sales_lead','admin','super_admin')
    )
  );

CREATE POLICY "Staff can delete lead reminders"
  ON public.lead_reminders FOR DELETE
  USING (
    is_admin(auth.uid())
    OR is_sales_lead(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = true
        AND au.role IN ('sales','sales_manager','sales_lead','admin','super_admin')
    )
  );