CREATE OR REPLACE FUNCTION public.protect_worked_lead_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bypass text;
  v_caller uuid;
  v_is_manager boolean := false;
  v_has_activity boolean := false;
BEGIN
  IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  v_bypass := current_setting('app.allow_reassign', true);
  v_caller := auth.uid();
  v_is_manager := v_caller IS NOT NULL AND public.can_manage_lead_routing(v_caller);
  v_has_activity := COALESCE(public.lead_has_human_activity(OLD.id), false)
    OR COALESCE(OLD.call_count, 0) > 0
    OR COALESCE(OLD.notes, '') <> ''
    OR OLD.status NOT IN ('new');

  -- A deliberate manager reassignment is the only normal way to change a
  -- worked lead's owner. Keep all history and make the new assignee the owner.
  IF v_is_manager THEN
    NEW.owner_agent := NEW.assigned_to;
    RETURN NEW;
  END IF;

  -- Maintenance bypass is reserved for explicit recovery operations.
  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  -- Google conversion processing may complete the record without taking it
  -- away from its owner.
  IF NEW.lead_source = 'google_ad' AND NEW.status = 'converted' THEN
    RETURN NEW;
  END IF;

  -- Round robin and every unauthenticated/background process must never take
  -- a lead that an agent has already worked or permanently owns.
  IF OLD.owner_agent IS NOT NULL OR (OLD.assigned_to IS NOT NULL AND v_has_activity) THEN
    NEW.assigned_to := COALESCE(OLD.owner_agent, OLD.assigned_to);
    NEW.owner_agent := COALESCE(OLD.owner_agent, OLD.assigned_to);
    NEW.assigned_at := OLD.assigned_at;
    NEW.orr_first_call_deadline := NULL;
    NEW.orr_retry_deadline := NULL;
    NEW.orr_pool_state := NULL;

    BEGIN
      INSERT INTO public.system_event_logs (event_type, event_source, event_data)
      VALUES (
        'lead_reassignment_blocked',
        'protect_worked_lead_assignment',
        jsonb_build_object(
          'lead_id', OLD.id,
          'preserved_owner', COALESCE(OLD.owner_agent, OLD.assigned_to),
          'attempted_assignee', NEW.assigned_to,
          'attempted_by', v_caller,
          'reason', 'worked or historically owned lead cannot be reassigned automatically'
        )
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_protect_touched_leads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bypass text;
  v_caller uuid;
  v_is_manager boolean := false;
BEGIN
  IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  v_bypass := current_setting('app.allow_reassign', true);
  v_caller := auth.uid();
  v_is_manager := v_caller IS NOT NULL AND public.can_manage_lead_routing(v_caller);

  IF v_is_manager THEN
    NEW.owner_agent := NEW.assigned_to;
    RETURN NEW;
  END IF;

  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  IF OLD.owner_agent IS NOT NULL OR public.lead_has_human_activity(OLD.id) THEN
    NEW.assigned_to := COALESCE(OLD.owner_agent, OLD.assigned_to);
    NEW.owner_agent := COALESCE(OLD.owner_agent, OLD.assigned_to);
    NEW.assigned_at := OLD.assigned_at;
    NEW.orr_first_call_deadline := NULL;
    NEW.orr_retry_deadline := NULL;
    NEW.orr_pool_state := NULL;

    BEGIN
      INSERT INTO public.system_event_logs (event_type, event_source, event_data)
      VALUES (
        'lead_reassignment_blocked',
        'protect_touched_leads',
        jsonb_build_object(
          'lead_id', OLD.id,
          'preserved_owner', COALESCE(OLD.owner_agent, OLD.assigned_to),
          'attempted_by', v_caller,
          'reason', 'lead has an established owner or human activity'
        )
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;