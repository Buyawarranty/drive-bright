CREATE OR REPLACE FUNCTION private.can_manage_monthly_revenue_targets(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _user_id
    AND role::text IN ('admin','super_admin','sales_manager') AND is_active = true);
$$;