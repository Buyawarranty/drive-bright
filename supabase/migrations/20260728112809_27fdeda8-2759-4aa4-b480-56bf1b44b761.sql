CREATE OR REPLACE FUNCTION public.orr_on_call_logged()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_uuid uuid; v_is_blue boolean; v_answered boolean;
  v_new_count int; v_next_release timestamptz;
BEGIN
  BEGIN v_lead_uuid := NEW.lead_id::uuid;
  EXCEPTION WHEN others THEN RETURN NEW; END;

  BEGIN
    SELECT public.is_agent_on_team_blue(assigned_to)
      INTO v_is_blue
    FROM public.sales_leads WHERE id = v_lead_uuid;

    IF v_is_blue IS NOT TRUE THEN RETURN NEW; END IF;

    v_answered := COALESCE(NEW.outcome,'') IN ('spoken','contacted','connected','sale','callback_booked');

    IF v_answered THEN
      UPDATE public.sales_leads
      SET orr_next_release_at = NULL, orr_locked_until = NULL,
          orr_first_call_deadline = NULL, orr_retry_deadline = NULL,
          orr_last_attempt_at = COALESCE(NEW.created_at, now()),
          orr_attempt_count = COALESCE(orr_attempt_count,0) + 1
      WHERE id = v_lead_uuid;
      INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
      VALUES (v_lead_uuid, NEW.agent_id, 'open_round_robin', 'orr_customer_answered');
      RETURN NEW;
    END IF;

    UPDATE public.sales_leads
    SET orr_attempt_count = COALESCE(orr_attempt_count,0) + 1,
        orr_last_attempt_at = COALESCE(NEW.created_at, now()),
        orr_first_call_deadline = NULL,
        orr_retry_deadline = NULL
    WHERE id = v_lead_uuid
    RETURNING orr_attempt_count INTO v_new_count;

    IF v_new_count IS NULL THEN RETURN NEW; END IF;

    v_next_release := public.orr_compute_next_release(v_new_count + 1, COALESCE(NEW.created_at, now()));

    UPDATE public.sales_leads
    SET orr_next_release_at = v_next_release, orr_locked_until = v_next_release
    WHERE id = v_lead_uuid;

    INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
    VALUES (v_lead_uuid, NEW.agent_id, 'open_round_robin',
            'orr_attempt_' || v_new_count || '_scheduled_next_' || (v_new_count + 1));
  EXCEPTION WHEN others THEN
    RAISE WARNING 'orr_on_call_logged skipped: %', SQLERRM;
  END;

  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.orr_clear_pool_on_call()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_lead_uuid uuid;
BEGIN
  BEGIN v_lead_uuid := NEW.lead_id::uuid;
  EXCEPTION WHEN others THEN RETURN NEW; END;

  BEGIN
    UPDATE public.sales_leads
    SET orr_pool_state = NULL,
        orr_pool_kind = NULL,
        orr_pool_since = NULL,
        orr_retry_deadline = NULL
    WHERE id = v_lead_uuid
      AND orr_pool_state IS NOT NULL;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'orr_clear_pool_on_call skipped: %', SQLERRM;
  END;

  RETURN NEW;
END; $function$;