-- Drop the recursive policy added previously
DROP POLICY IF EXISTS "Active admin users can view all admin users" ON public.admin_users;

-- Security definer helper that bypasses RLS on admin_users
CREATE OR REPLACE FUNCTION public.is_active_admin_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id AND is_active = true
  )
$$;

-- Recreate policy using the helper (no recursion)
CREATE POLICY "Active admin users can view all admin users"
ON public.admin_users
FOR SELECT
TO authenticated
USING (public.is_active_admin_user(auth.uid()));
