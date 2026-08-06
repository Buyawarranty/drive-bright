CREATE OR REPLACE FUNCTION public.auto_reassign_google_ad_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bypass text := current_setting('app.allow_reassign', true);
BEGIN
  -- Authorised (manager) reassignment always wins
  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'converted'
     AND NEW.lead_source IN ('google_ad', 'social_ad', 'bing_ad', 'website') THEN
    -- Online self-serve sale: always credited to Website (unassigned)
    NEW.assigned_to := NULL;
    NEW.assigned_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_website_sale_owner_locked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bypass text := current_setting('app.allow_reassign', true);
BEGIN
  IF v_bypass = 'on' OR public.is_management(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     AND NEW.assigned_to IS NOT NULL
     AND COALESCE(NEW.status, OLD.status) = 'converted'
     AND COALESCE(NEW.lead_source, OLD.lead_source) IN ('google_ad', 'social_ad', 'bing_ad', 'website') THEN
    RAISE EXCEPTION 'This is an online self-serve sale and stays with Website. Management authorisation is required to assign an agent.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_website_sale_owner_locked ON public.sales_leads;
CREATE TRIGGER trg_guard_website_sale_owner_locked
BEFORE UPDATE OF assigned_to ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.guard_website_sale_owner_locked();