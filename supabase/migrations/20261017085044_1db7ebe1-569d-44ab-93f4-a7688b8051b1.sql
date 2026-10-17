CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
ALTER FUNCTION public.get_lead_quality_report(date,date) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.get_lead_quality_report(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_lead_quality_report(date,date) TO authenticated;
CREATE FUNCTION public.get_lead_quality_report(p_from date,p_to date) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.get_lead_quality_report(p_from,p_to); $$;
REVOKE ALL ON FUNCTION public.get_lead_quality_report(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lead_quality_report(date,date) TO authenticated;