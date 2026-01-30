
-- Add RLS policy for sales users to view customers assigned to them
CREATE POLICY "Sales users can view assigned customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  assigned_to IN (
    SELECT id FROM admin_users WHERE user_id = auth.uid()
  )
  OR payment_confirmed_by IN (
    SELECT id FROM admin_users WHERE user_id = auth.uid()
  )
  OR quote_sent_by IN (
    SELECT id FROM admin_users WHERE user_id = auth.uid()
  )
);

-- Add RLS policy for sales users to update customers assigned to them
CREATE POLICY "Sales users can update assigned customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  assigned_to IN (
    SELECT id FROM admin_users WHERE user_id = auth.uid()
  )
  OR payment_confirmed_by IN (
    SELECT id FROM admin_users WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  assigned_to IN (
    SELECT id FROM admin_users WHERE user_id = auth.uid()
  )
  OR payment_confirmed_by IN (
    SELECT id FROM admin_users WHERE user_id = auth.uid()
  )
);
