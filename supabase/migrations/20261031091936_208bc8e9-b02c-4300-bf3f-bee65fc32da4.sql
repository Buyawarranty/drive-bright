CREATE OR REPLACE FUNCTION public.can_see_lead_source()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public
AS $function$
 SELECT public.is_active_admin_user(auth.uid())
 AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('sales','sales_lead','sales_manager'))
 AND NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id=auth.uid() AND role::text IN ('sales','sales_lead','sales_manager'))
 AND (
 EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','super_admin'))
 OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id=auth.uid() AND is_active AND (lower(email) LIKE 'ads@%' OR lower(email) LIKE 'seo@%'))
 OR EXISTS (SELECT 1 FROM public.staff_export_grants WHERE admin_user_id=public.current_admin_user_id() AND can_see_lead_source)
 );
$function$;
REVOKE ALL ON FUNCTION public.can_see_lead_source() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_lead_source() TO authenticated, service_role;