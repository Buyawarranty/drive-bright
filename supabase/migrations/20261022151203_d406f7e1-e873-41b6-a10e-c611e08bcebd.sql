-- Pin search_path on SECURITY DEFINER functions flagged by the security scanner.
-- Setting search_path to 'public' stops a caller's search path from being used
-- to resolve objects inside these functions, while keeping their existing
-- public-schema references working (safer than '' since bodies are not
-- fully schema-qualified).

ALTER FUNCTION public.ensure_admin_user_exists() SET search_path = 'public';
ALTER FUNCTION public.link_policy_to_user_by_email() SET search_path = 'public';
ALTER FUNCTION public.is_ip_blocked(inet) SET search_path = 'public';
ALTER FUNCTION public.log_click_activity(inet, text, text, text, integer) SET search_path = 'public';
ALTER FUNCTION public.link_policy_to_user() SET search_path = 'public';
ALTER FUNCTION public.make_user_admin(text) SET search_path = 'public';
ALTER FUNCTION public.get_next_warranty_serial() SET search_path = 'public';
ALTER FUNCTION public.log_warranty_event(uuid, uuid, text, jsonb, text) SET search_path = 'public';