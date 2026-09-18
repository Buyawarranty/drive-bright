CREATE OR REPLACE FUNCTION public.open_pool_log_outcome_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.call_outcome IS DISTINCT FROM OLD.call_outcome AND NEW.call_outcome IN ('no_answer','voicemail_left','line_busy') THEN
    INSERT INTO public.lead_activities(lead_id,activity_type,description)
    VALUES(NEW.id,'system','Open Round Robin attempt '||COALESCE(NEW.call_count,0)::text||': '||replace(NEW.call_outcome,'_',' ')||' — not owned; returned to the shared retry pool'||CASE WHEN NEW.next_action_at IS NOT NULL THEN ' until '||to_char(NEW.next_action_at AT TIME ZONE 'Europe/London','DD Mon YYYY HH24:MI') ELSE '' END||'.');
  ELSIF NEW.call_outcome IS DISTINCT FROM OLD.call_outcome AND NEW.call_outcome='spoke_to_customer' AND NEW.owner_agent IS NOT NULL THEN
    INSERT INTO public.lead_activities(lead_id,activity_type,description)
    VALUES(NEW.id,'system','Connected — ownership assigned to the salesperson who reached the customer.');
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_open_pool_log_outcome_activity ON public.sales_leads;
CREATE TRIGGER trg_open_pool_log_outcome_activity AFTER UPDATE OF call_outcome ON public.sales_leads FOR EACH ROW EXECUTE FUNCTION public.open_pool_log_outcome_activity();
REVOKE ALL ON FUNCTION public.open_pool_log_outcome_activity() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.open_pool_log_outcome_activity() TO service_role;