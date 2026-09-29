REVOKE ALL ON FUNCTION public.agent_works_renewals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_works_renewals(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.agent_works_renewals(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.agent_works_renewals(uuid) TO service_role;