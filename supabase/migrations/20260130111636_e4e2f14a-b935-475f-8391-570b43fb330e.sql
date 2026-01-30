-- Update the RLS policy to allow all active admin users (sales, member, admin) to self-assign unassigned leads
-- Also update to allow admins to assign leads to any user

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Sales users can assign unassigned leads to themselves" ON sales_leads;

-- Create new policy: Any active admin user can assign unassigned leads to themselves
CREATE POLICY "Active users can self-assign unassigned leads"
ON sales_leads
FOR UPDATE
USING (
  assigned_to IS NULL 
  AND EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.is_active = true
  )
)
WITH CHECK (
  -- Allow self-assignment: new assigned_to must be current user's admin_users.id
  assigned_to IN (
    SELECT admin_users.id FROM admin_users WHERE admin_users.user_id = auth.uid()
  )
  -- OR user is an admin (can assign to anyone)
  OR is_admin(auth.uid())
);