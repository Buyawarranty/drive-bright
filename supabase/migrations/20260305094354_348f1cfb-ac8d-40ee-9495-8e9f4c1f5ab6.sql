
-- Drop the restrictive update policies for sales agents
DROP POLICY IF EXISTS "Sales users can update assigned leads" ON public.sales_leads;
DROP POLICY IF EXISTS "Active users can self-assign unassigned leads" ON public.sales_leads;

-- Create a single broad update policy: any active admin user can update any lead
CREATE POLICY "Active admin users can update all leads"
ON public.sales_leads
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
);
