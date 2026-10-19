ALTER FUNCTION public.can_manage_reporting(uuid) SECURITY INVOKER;
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated,service_role;
ALTER FUNCTION public.reporting_record_payment(uuid,numeric,date,text) SET SCHEMA private;
CREATE FUNCTION public.reporting_record_payment(_invoice uuid,_amount numeric,_paid_on date,_reference text) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT private.reporting_record_payment(_invoice,_amount,_paid_on,_reference); $$;
REVOKE ALL ON FUNCTION public.reporting_record_payment(uuid,numeric,date,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.reporting_record_payment(uuid,numeric,date,text) TO authenticated;
REVOKE ALL ON FUNCTION private.reporting_record_payment(uuid,numeric,date,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION private.reporting_record_payment(uuid,numeric,date,text) TO authenticated;