CREATE OR REPLACE FUNCTION public.has_price_updates_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id
      AND is_active = true
      AND role IN ('admin', 'super_admin', 'sales_manager', 'accounts', 'accounts_manager')
  );
$$;
