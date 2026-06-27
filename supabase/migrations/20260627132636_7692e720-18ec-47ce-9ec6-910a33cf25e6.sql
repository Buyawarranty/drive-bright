CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'super_admin', 'dev_tester', 'sales_manager', 'performance_manager')
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_sales(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'super_admin', 'dev_tester', 'sales', 'sales_lead', 'sales_manager', 'performance_manager', 'accounts_manager', 'accounts_payroll', 'accounts', 'lead_gen', 'claims_agent', 'claims_manager')
      AND is_active = true
  );
$$;