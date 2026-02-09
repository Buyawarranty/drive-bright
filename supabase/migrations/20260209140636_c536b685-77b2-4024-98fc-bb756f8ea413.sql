-- Drop the broken policies that use direct admin_users queries (subject to RLS)
DROP POLICY IF EXISTS "Sales leads can view all leads" ON public.sales_leads;
DROP POLICY IF EXISTS "Sales leads can update all leads" ON public.sales_leads;
DROP POLICY IF EXISTS "Sales leads can view all abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Sales leads can update all abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Sales leads can view all admin users" ON public.admin_users;

-- Create a SECURITY DEFINER function to check sales_lead role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_sales_lead(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id
    AND role = 'sales_lead'
    AND is_active = true
  );
$$;

-- Recreate policies using SECURITY DEFINER function
CREATE POLICY "Sales leads can view all leads"
ON public.sales_leads FOR SELECT
USING (is_sales_lead(auth.uid()));

CREATE POLICY "Sales leads can update all leads"
ON public.sales_leads FOR UPDATE
USING (is_sales_lead(auth.uid()));

CREATE POLICY "Sales leads can view all abandoned carts"
ON public.abandoned_carts FOR SELECT
USING (is_sales_lead(auth.uid()));

CREATE POLICY "Sales leads can update all abandoned carts"
ON public.abandoned_carts FOR UPDATE
USING (is_sales_lead(auth.uid()));

CREATE POLICY "Sales leads can view all admin users"
ON public.admin_users FOR SELECT
USING (is_sales_lead(auth.uid()));