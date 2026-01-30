
-- Create a helper function to check if user is a sales user (or admin)
CREATE OR REPLACE FUNCTION public.is_admin_or_sales(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id 
    AND role IN ('admin', 'sales')
    AND is_active = true
  );
$$;

-- Drop the old restrictive sales SELECT policy
DROP POLICY IF EXISTS "Sales users can view assigned customers" ON public.customers;

-- Create new policy allowing all sales and admin users to view all customers
CREATE POLICY "Admin and sales can view all customers"
ON public.customers
FOR SELECT
TO authenticated
USING (public.is_admin_or_sales(auth.uid()));

-- Drop the duplicate admin-only view policy since the new one covers both
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;
