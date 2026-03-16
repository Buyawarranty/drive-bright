-- Allow sales and admin staff to update customer_policies (not just admins)
DROP POLICY IF EXISTS "Admins can manage all policies" ON public.customer_policies;

CREATE POLICY "Admins can manage all policies"
ON public.customer_policies
FOR ALL
TO authenticated
USING (is_admin_or_sales(auth.uid()))
WITH CHECK (is_admin_or_sales(auth.uid()));