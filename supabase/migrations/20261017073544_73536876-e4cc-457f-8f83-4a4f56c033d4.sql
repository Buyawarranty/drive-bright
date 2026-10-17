CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
ALTER FUNCTION public.get_excluded_abandoned_cart_ids(uuid[]) SET SCHEMA private;
CREATE OR REPLACE FUNCTION public.get_excluded_abandoned_cart_ids(p_cart_ids uuid[])
RETURNS TABLE(id uuid) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT * FROM private.get_excluded_abandoned_cart_ids(p_cart_ids);
$$;
REVOKE ALL ON FUNCTION public.get_excluded_abandoned_cart_ids(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_excluded_abandoned_cart_ids(uuid[]) TO authenticated, service_role;