-- Update is_admin_or_sales to include accounts_payroll using text cast
CREATE OR REPLACE FUNCTION public.is_admin_or_sales(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id
    AND role::text IN ('admin', 'super_admin', 'sales', 'sales_lead', 'dev_tester', 'accounts_manager', 'accounts_payroll')
    AND is_active = true
  );
$$;