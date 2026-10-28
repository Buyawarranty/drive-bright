ALTER FUNCTION public.open_pool_next_call_slot() SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.open_pool_next_call_slot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_pool_next_call_slot() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.open_pool_log_outcome(uuid,uuid,text,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_pool_log_outcome(uuid,uuid,text,text,timestamptz) TO authenticated, service_role;