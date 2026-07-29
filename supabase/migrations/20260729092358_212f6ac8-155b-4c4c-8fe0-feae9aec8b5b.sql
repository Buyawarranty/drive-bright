-- 1) Propagate lead owner changes to the linked customer record
CREATE OR REPLACE FUNCTION public.sync_lead_owner_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  norm_email text := lower(trim(coalesce(NEW.email, '')));
  norm_reg   text := upper(regexp_replace(coalesce(NEW.vehicle_reg, ''), '\s+', '', 'g'));
BEGIN
  IF NEW.assigned_to IS NULL
     OR NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  IF norm_email = '' AND norm_reg = '' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.id = NEW.assigned_to AND au.role IN ('sales', 'sales_lead')
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.customers c
  SET assigned_to = NEW.assigned_to,
      updated_at = now()
  WHERE coalesce(c.is_deleted, false) = false
    AND c.assigned_to IS DISTINCT FROM NEW.assigned_to
    AND lower(coalesce(c.status, '')) NOT IN ('cancelled', 'refunded')
    AND (
      (norm_email <> '' AND lower(trim(c.email)) = norm_email)
      OR (norm_reg <> '' AND upper(regexp_replace(coalesce(c.registration_plate, ''), '\s+', '', 'g')) = norm_reg)
    );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_lead_owner_to_customer ON public.sales_leads;
CREATE TRIGGER trg_sync_lead_owner_to_customer
AFTER UPDATE OF assigned_to ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_owner_to_customer();

-- 2) Let deliberate manager reassignment win over the google_ad -> Website rule
CREATE OR REPLACE FUNCTION public.auto_reassign_google_ad_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bypass text := current_setting('app.allow_reassign', true);
BEGIN
  -- Explicit manager-driven reassignment always wins
  IF v_bypass = 'on' AND NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Only act when status changes TO 'converted' and the lead is from Google Ads
  IF NEW.status = 'converted' AND NEW.lead_source = 'google_ad' THEN
    NEW.assigned_to := NULL;
    NEW.assigned_at := NULL;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'converted' AND OLD.lead_source = 'google_ad'
     AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    NEW.assigned_to := NULL;
    NEW.assigned_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;