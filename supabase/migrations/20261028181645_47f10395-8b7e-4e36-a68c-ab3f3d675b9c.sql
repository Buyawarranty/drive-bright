CREATE SCHEMA IF NOT EXISTS private_lead_access;
REVOKE ALL ON SCHEMA private_lead_access FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private_lead_access TO authenticated,service_role;
ALTER FUNCTION public.can_access_assigned_sales_lead(uuid,boolean) SET SCHEMA private_lead_access;
ALTER FUNCTION public.can_access_checkout_alert(text,text) SET SCHEMA private_lead_access;