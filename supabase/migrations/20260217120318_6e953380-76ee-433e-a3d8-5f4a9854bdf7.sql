-- Drop the recursive policy
DROP POLICY IF EXISTS "Sales users can view all admin users" ON public.admin_users;

-- Recreate without recursion: just allow any authenticated user to see admin_users
-- (the table only contains admin/sales staff, not customer PII, so this is safe)
-- The existing "Users can view their own admin profile" already covers self-access;
-- this broader policy lets sales agents see colleague names for lead assignments.
CREATE POLICY "Authenticated users can view admin users"
  ON public.admin_users
  FOR SELECT
  USING (auth.uid() IS NOT NULL);