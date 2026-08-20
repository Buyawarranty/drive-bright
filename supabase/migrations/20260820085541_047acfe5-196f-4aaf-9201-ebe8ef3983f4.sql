REVOKE ALL ON FUNCTION public.evaluate_agent_lead_freeze() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_agent_lead_allocation(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_agent_auto_freeze(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_agent_lead_freeze() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_agent_lead_allocation(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_agent_auto_freeze(uuid, boolean) TO authenticated, service_role;