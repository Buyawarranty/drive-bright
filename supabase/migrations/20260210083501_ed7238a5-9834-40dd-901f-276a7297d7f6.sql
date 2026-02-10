-- Update is_admin to include dev_tester role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id 
    AND role IN ('admin', 'dev_tester')
    AND is_active = true
  );
$$;

-- Update is_admin_or_sales to include dev_tester role
CREATE OR REPLACE FUNCTION public.is_admin_or_sales(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id 
    AND role IN ('admin', 'dev_tester', 'sales', 'sales_lead')
    AND is_active = true
  );
$$;