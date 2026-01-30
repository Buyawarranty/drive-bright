-- Drop and recreate the self-assignment policy with correct logic
DROP POLICY IF EXISTS "Active users can self-assign unassigned leads" ON public.sales_leads;

-- Create a more permissive policy for sales agents to self-assign unassigned leads
-- This allows any active admin_user to assign an unassigned lead to themselves
CREATE POLICY "Active users can self-assign unassigned leads"
ON public.sales_leads
FOR UPDATE
TO authenticated
USING (
    -- Can update if lead is unassigned AND user is an active admin user
    assigned_to IS NULL
    AND EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.user_id = auth.uid() 
        AND admin_users.is_active = true
    )
)
WITH CHECK (
    -- New assigned_to must be the current user's admin_users.id
    -- OR user is a full admin (can assign to anyone)
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.id = assigned_to 
        AND admin_users.user_id = auth.uid()
    )
    OR is_admin(auth.uid())
);

-- Also make sure the "Sales users can update assigned leads" policy works correctly
-- This allows updating leads that are already assigned to the user
DROP POLICY IF EXISTS "Sales users can update assigned leads" ON public.sales_leads;

CREATE POLICY "Sales users can update assigned leads"
ON public.sales_leads
FOR UPDATE
TO authenticated
USING (
    -- Can update if lead is assigned to the current user
    assigned_to IN (
        SELECT id FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
    OR is_admin(auth.uid())
)
WITH CHECK (
    -- After update, lead must still be assigned to the user (or admin can do anything)
    assigned_to IN (
        SELECT id FROM admin_users WHERE admin_users.user_id = auth.uid()
    )
    OR is_admin(auth.uid())
);