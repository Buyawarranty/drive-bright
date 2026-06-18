DROP POLICY IF EXISTS "Admins can read ab visits" ON public.ab_variant_visits;
CREATE POLICY "Staff can read ab visits"
ON public.ab_variant_visits
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid())
  OR is_super_admin()
  OR is_sales_lead(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);