-- abandoned_carts: three overlapping SELECT policies, the broadest of which ran a
-- correlated admin_users EXISTS per row for non-admin (i.e. sales) callers.
DROP POLICY IF EXISTS "Admins can view abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Sales leads can view all abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Sales users can view assigned abandoned carts" ON public.abandoned_carts;

CREATE POLICY "Active staff can view abandoned carts"
ON public.abandoned_carts
FOR SELECT
TO authenticated
USING (public.is_active_admin_user((SELECT auth.uid())));

-- sales_leads: same pattern. The OR-chain ended in an uncached per-row EXISTS,
-- which already granted access to every active staff member, so the cached
-- security-definer check is equivalent and evaluated once per query.
DROP POLICY IF EXISTS "Admin and sales can view leads" ON public.sales_leads;

CREATE POLICY "Active staff can view leads"
ON public.sales_leads
FOR SELECT
TO authenticated
USING (public.is_active_admin_user((SELECT auth.uid())));