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
    AND role IN ('admin', 'super_admin', 'dev_tester', 'sales', 'sales_lead')
    AND is_active = true
  );
$$;