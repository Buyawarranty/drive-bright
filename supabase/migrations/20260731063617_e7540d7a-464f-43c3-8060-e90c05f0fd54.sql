-- Any active staff account can view/update customers
DROP POLICY IF EXISTS "Sales and admin can update all customers" ON public.customers;
CREATE POLICY "Active staff can update all customers"
ON public.customers FOR UPDATE TO authenticated
USING (public.is_active_admin_user(auth.uid()))
WITH CHECK (public.is_active_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin and sales can view all customers" ON public.customers;
CREATE POLICY "Active staff can view all customers"
ON public.customers FOR SELECT TO authenticated
USING (public.is_active_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Sales can insert customers" ON public.customers;
CREATE POLICY "Active staff can insert customers"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (public.is_active_admin_user(auth.uid()));

-- Policies table: same broadening
DROP POLICY IF EXISTS "Admins can manage all policies" ON public.customer_policies;
CREATE POLICY "Active staff can manage all policies"
ON public.customer_policies FOR ALL TO authenticated
USING (public.is_active_admin_user(auth.uid()))
WITH CHECK (public.is_active_admin_user(auth.uid()));