DROP POLICY IF EXISTS "Admins can view struggle alerts" ON public.checkout_struggle_alerts;
DROP POLICY IF EXISTS "Admins can update struggle alerts" ON public.checkout_struggle_alerts;

CREATE POLICY "Staff can view struggle alerts"
ON public.checkout_struggle_alerts
FOR SELECT
USING (public.is_admin_or_sales(auth.uid()));

CREATE POLICY "Staff can update struggle alerts"
ON public.checkout_struggle_alerts
FOR UPDATE
USING (public.is_admin_or_sales(auth.uid()));