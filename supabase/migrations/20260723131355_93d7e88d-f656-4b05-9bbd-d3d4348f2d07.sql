CREATE OR REPLACE FUNCTION public.protect_worked_lead_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bypass text;
BEGIN
  IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  v_bypass := current_setting('app.allow_reassign', true);
  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  IF OLD.assigned_to IS NOT NULL
    AND (
      OLD.status NOT IN ('new')
      OR COALESCE(OLD.call_count, 0) > 0
      OR (OLD.notes IS NOT NULL AND OLD.notes != '')
    )
  THEN
    IF auth.uid() IS NOT NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.lead_source = 'google_ad' AND NEW.status = 'converted' THEN
      RETURN NEW;
    END IF;

    NEW.assigned_to := OLD.assigned_to;
    NEW.assigned_at := OLD.assigned_at;
  END IF;

  RETURN NEW;
END;
$function$;