ALTER FUNCTION public.offboard_agent_handover(uuid,uuid[],uuid[],boolean,boolean,text) SET statement_timeout = '180s';
ALTER FUNCTION public.restore_agent_offboarding_backup(uuid,uuid) SET statement_timeout = '180s';
ALTER FUNCTION public.create_agent_offboarding_backup(uuid,uuid,boolean,boolean,text) SET statement_timeout = '180s';
NOTIFY pgrst, 'reload schema';