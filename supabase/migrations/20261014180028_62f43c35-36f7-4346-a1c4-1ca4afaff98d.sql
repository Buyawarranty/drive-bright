REVOKE EXECUTE ON FUNCTION public.is_super_admin_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin_user(uuid) TO authenticated, service_role;