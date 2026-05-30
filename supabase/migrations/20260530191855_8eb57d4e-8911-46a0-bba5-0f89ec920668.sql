DROP POLICY IF EXISTS "Admin and sales can view leads" ON public.sales_leads;

CREATE POLICY "Admin and sales can view leads"
ON public.sales_leads
FOR SELECT
USING (
  is_admin((SELECT auth.uid())) OR
  is_sales_lead((SELECT auth.uid())) OR
  has_all_leads_permission((SELECT auth.uid())) OR
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = (SELECT auth.uid())
      AND admin_users.is_active = true
  )
);