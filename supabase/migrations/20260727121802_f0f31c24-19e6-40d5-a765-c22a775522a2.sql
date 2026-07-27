DROP POLICY IF EXISTS "Staff can insert lead_customers" ON public.lead_customers;
DROP POLICY IF EXISTS "Staff can update lead_customers" ON public.lead_customers;

CREATE POLICY "Staff can insert lead_customers"
ON public.lead_customers FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active = true));

CREATE POLICY "Staff can update lead_customers"
ON public.lead_customers FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active = true));