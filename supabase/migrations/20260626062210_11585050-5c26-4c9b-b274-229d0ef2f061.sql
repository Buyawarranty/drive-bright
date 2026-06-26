-- Allow ANY active staff member (admin_users row) to add/view/manage email unsubscribes
-- so all team members can opt customers out from the dashboard.
CREATE POLICY "Staff can view email unsubscribes"
ON public.email_unsubscribes
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid() AND au.is_active = true));

CREATE POLICY "Staff can insert email unsubscribes"
ON public.email_unsubscribes
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid() AND au.is_active = true));

CREATE POLICY "Staff can update email unsubscribes"
ON public.email_unsubscribes
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid() AND au.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid() AND au.is_active = true));