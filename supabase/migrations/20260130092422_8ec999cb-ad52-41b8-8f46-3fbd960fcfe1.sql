-- Allow sales users to SELECT unassigned leads (awaiting contact)
-- This enables sales agents to see leads in the "Take action" section

CREATE POLICY "Sales users can view unassigned leads"
ON public.sales_leads
FOR SELECT
USING (
  -- Lead must be unassigned (awaiting contact)
  assigned_to IS NULL
  -- AND the user must be a valid sales/admin user
  AND EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
);