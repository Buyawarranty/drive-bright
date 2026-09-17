CREATE OR REPLACE FUNCTION public.has_manager_discount_access(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin','super_admin','sales_manager')
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = _user_id
      AND au.is_active
      AND au.role IN ('admin','super_admin','sales_manager')
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = _user_id
      AND au.is_active
      AND COALESCE((au.permissions->>'tab_discount-codes_manager-view')::boolean, false)
  )
  OR EXISTS (
    SELECT 1
    FROM public.manager_discount_access mda
    JOIN auth.users u ON lower(u.email) = lower(mda.email)
    WHERE u.id = _user_id AND mda.enabled
  )
$function$;