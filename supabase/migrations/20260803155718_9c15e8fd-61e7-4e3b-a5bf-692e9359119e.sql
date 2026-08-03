CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = _user_id AND au.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;