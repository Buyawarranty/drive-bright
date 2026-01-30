-- Allow sales users to assign unassigned leads (awaiting contact) to themselves
-- This enables the "Take action" button for sales agents

CREATE POLICY "Sales users can assign unassigned leads to themselves"
ON public.sales_leads
FOR UPDATE
USING (
  -- Lead must be unassigned (awaiting contact)
  assigned_to IS NULL
  -- AND the user must be a valid sales/admin user
  AND EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
)
WITH CHECK (
  -- They can only assign to themselves
  assigned_to IN (
    SELECT id FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);