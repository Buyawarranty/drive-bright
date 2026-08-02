CREATE OR REPLACE FUNCTION public.trg_protect_touched_leads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bypass text;
  v_caller uuid;
BEGIN
  IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  v_bypass := current_setting('app.allow_reassign', true);
  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  -- Managers / agents explicitly granted reassign rights may always move leads
  v_caller := auth.uid();
  IF v_caller IS NOT NULL AND public.can_manage_lead_routing(v_caller) THEN
    RETURN NEW;
  END IF;

  IF public.lead_has_human_activity(OLD.id) THEN
    NEW.assigned_to := OLD.assigned_to;
    NEW.assigned_at := OLD.assigned_at;
    NEW.orr_first_call_deadline := NULL;
    NEW.orr_retry_deadline := NULL;
    NEW.orr_pool_state := NULL;

    INSERT INTO public.system_event_logs (event_type, event_source, event_data)
    VALUES (
      'lead_reassignment_blocked',
      'protect_touched_leads',
      jsonb_build_object(
        'lead_id', OLD.id,
        'attempted_from', OLD.assigned_to,
        'attempted_by', v_caller,
        'reason', 'lead has notes or call activity and caller is not authorised to reassign'
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_worked_lead_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bypass text;
  v_caller uuid;
BEGIN
  IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  v_bypass := current_setting('app.allow_reassign', true);
  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  v_caller := auth.uid();
  IF v_caller IS NOT NULL AND public.can_manage_lead_routing(v_caller) THEN
    RETURN NEW;
  END IF;

  IF OLD.assigned_to IS NOT NULL
    AND (
      OLD.status NOT IN ('new')
      OR COALESCE(OLD.call_count, 0) > 0
      OR (OLD.notes IS NOT NULL AND OLD.notes != '')
    )
  THEN
    IF v_caller IS NOT NULL THEN
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