CREATE OR REPLACE FUNCTION public.sync_owner_from_lead_on_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  norm_email text := lower(trim(coalesce(NEW.email, '')));
  norm_reg   text := upper(regexp_replace(coalesce(NEW.registration_plate, ''), '\s+', '', 'g'));
  lead_owner uuid;
BEGIN
  IF coalesce(NEW.is_deleted, false) = true
     OR lower(coalesce(NEW.status, '')) IN ('cancelled', 'refunded') THEN
    RETURN NEW;
  END IF;

  IF norm_email = '' AND norm_reg = '' THEN
    RETURN NEW;
  END IF;

  SELECT sl.assigned_to INTO lead_owner
  FROM public.sales_leads sl
  WHERE sl.assigned_to IS NOT NULL
    AND sl.status <> 'fake_lead'::lead_status
    AND (
      (norm_email <> '' AND lower(trim(sl.email)) = norm_email)
      OR (norm_reg <> '' AND upper(regexp_replace(coalesce(sl.vehicle_reg, ''), '\s+', '', 'g')) = norm_reg)
    )
  ORDER BY sl.created_at ASC
  LIMIT 1;

  IF lead_owner IS NOT NULL THEN
    NEW.assigned_to := lead_owner;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_owner_from_lead ON public.customers;
CREATE TRIGGER trg_sync_owner_from_lead
BEFORE INSERT OR UPDATE OF assigned_to, email, registration_plate ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.sync_owner_from_lead_on_customer();

CREATE OR REPLACE FUNCTION public.backfill_lead_owner_from_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  norm_email text := lower(trim(coalesce(NEW.email, '')));
  norm_reg   text := upper(regexp_replace(coalesce(NEW.registration_plate, ''), '\s+', '', 'g'));
BEGIN
  IF NEW.assigned_to IS NULL
     OR coalesce(NEW.is_deleted, false) = true
     OR lower(coalesce(NEW.status, '')) IN ('cancelled', 'refunded') THEN
    RETURN NEW;
  END IF;

  IF norm_email = '' AND norm_reg = '' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.id = NEW.assigned_to
      AND au.role IN ('sales', 'sales_lead')
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.sales_leads sl
  SET assigned_to = NEW.assigned_to,
      updated_at = now()
  WHERE sl.assigned_to IS NULL
    AND sl.status <> 'fake_lead'::lead_status
    AND (
      (norm_email <> '' AND lower(trim(sl.email)) = norm_email)
      OR (norm_reg <> '' AND upper(regexp_replace(coalesce(sl.vehicle_reg, ''), '\s+', '', 'g')) = norm_reg)
    );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_backfill_lead_owner ON public.customers;
CREATE TRIGGER trg_backfill_lead_owner
AFTER INSERT OR UPDATE OF assigned_to ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.backfill_lead_owner_from_customer();