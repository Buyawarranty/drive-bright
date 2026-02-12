-- Fix: Allow sales users to update status on unassigned leads without requiring self-assignment
-- The current with_check on the self-assign policy requires assigned_to = current_user after update,
-- which prevents status-only updates on unassigned leads.

DROP POLICY "Active users can self-assign unassigned leads" ON public.sales_leads;

CREATE POLICY "Active users can self-assign unassigned leads"
ON public.sales_leads
FOR UPDATE
USING (
  (assigned_to IS NULL) AND (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true
  ))
)
WITH CHECK (
  -- Allow self-assignment (assigned_to = current user)
  (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = sales_leads.assigned_to AND admin_users.user_id = auth.uid()
  ))
  -- Allow status-only updates (assigned_to stays NULL)
  OR (assigned_to IS NULL AND EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true
  ))
  OR is_admin(auth.uid())
);