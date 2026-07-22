
-- 1. Helper: has this lead had any real agent activity?
CREATE OR REPLACE FUNCTION public.lead_has_human_activity(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.lead_quick_notes lqn
      WHERE lqn.lead_id = p_lead_id
    )
    OR EXISTS (
      SELECT 1 FROM public.lead_call_logs lcl
      WHERE lcl.lead_id = p_lead_id::text
    )
    OR EXISTS (
      SELECT 1 FROM public.sales_leads sl
      WHERE sl.id = p_lead_id
        AND COALESCE(sl.call_count, 0) > 0
    );
$$;

GRANT EXECUTE ON FUNCTION public.lead_has_human_activity(uuid) TO authenticated, service_role;

-- 2. Guard trigger on sales_leads: block silent unassignment of touched leads.
-- Bypass via GUC 'app.allow_reassign' = 'on' (managers set this before allocating).
CREATE OR REPLACE FUNCTION public.trg_protect_touched_leads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bypass text;
BEGIN
  -- Only care about assignment being cleared or changed
  IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  -- If lead has been touched, block silent reassignment/unassignment
  IF public.lead_has_human_activity(OLD.id) THEN
    v_bypass := current_setting('app.allow_reassign', true);
    IF v_bypass IS DISTINCT FROM 'on' THEN
      -- Keep the original owner; do not un-assign a touched lead
      NEW.assigned_to := OLD.assigned_to;
      NEW.assigned_at := OLD.assigned_at;
      -- Clear any ORR deadlines so it does not keep re-triggering the sweep
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
          'attempted_to', NEW.assigned_to,
          'reason', 'lead has notes or call activity'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_touched_leads ON public.sales_leads;
CREATE TRIGGER trg_protect_touched_leads
  BEFORE UPDATE OF assigned_to ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_touched_leads();

-- 3. When a note is added to a lead, clear any ORR expiry deadlines
-- (belt-and-braces so the sweep won't even try to touch it).
CREATE OR REPLACE FUNCTION public.trg_note_protects_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sales_leads
  SET orr_first_call_deadline = NULL,
      orr_retry_deadline = NULL,
      orr_pool_state = NULL
  WHERE id = NEW.lead_id
    AND (orr_first_call_deadline IS NOT NULL
      OR orr_retry_deadline IS NOT NULL
      OR orr_pool_state IS NOT NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_note_protects_lead ON public.lead_quick_notes;
CREATE TRIGGER trg_note_protects_lead
  AFTER INSERT ON public.lead_quick_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_note_protects_lead();

-- 4. Update ORR sweep functions to also skip leads with notes.
CREATE OR REPLACE FUNCTION public.orr_sweep_attempt_one_expiries()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row       RECORD;
  v_prev      uuid;
  v_kind      text;
  v_new_agent uuid;
  v_avail     uuid[];
  v_assigned  jsonb;
  v_missed    int := 0;
  v_reoffered int := 0;
  v_returned  int := 0;
BEGIN
  FOR v_row IN
    SELECT sl.id, sl.assigned_to, sl.phone_normalized,
           sl.orr_first_call_kind, sl.orr_first_call_deadline,
           sl.assigned_at, sl.lead_source
    FROM public.sales_leads sl
    WHERE sl.orr_first_call_deadline IS NOT NULL
      AND sl.orr_first_call_deadline < now()
      AND sl.assigned_to IS NOT NULL
      AND COALESCE(sl.orr_attempt_count,0) = 0
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND public.is_agent_on_team_blue(sl.assigned_to)
      AND public.orr_agent_is_orr_mode(sl.assigned_to)
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_call_logs lcl
        WHERE lcl.lead_id = sl.id::text
          AND lcl.created_at >= COALESCE(sl.assigned_at, now() - interval '1 day')
      )
      -- NEW: agent notes protect the lead
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_quick_notes lqn
        WHERE lqn.lead_id = sl.id
      )
    ORDER BY sl.orr_first_call_deadline ASC
    LIMIT 200
  LOOP
    v_prev := v_row.assigned_to;
    v_kind := COALESCE(v_row.orr_first_call_kind, 'live');
    v_missed := v_missed + 1;

    -- Bypass the touched-lead guard for this legitimate sweep
    PERFORM set_config('app.allow_reassign', 'on', true);

    UPDATE public.sales_leads
    SET assigned_to = NULL,
        assigned_at = NULL,
        orr_first_call_deadline = NULL,
        orr_first_call_notified_at = NULL,
        orr_first_call_missed_by = v_prev,
        orr_first_call_missed_at = now(),
        orr_first_call_missed_count = COALESCE(orr_first_call_missed_count,0) + 1
    WHERE id = v_row.id;

    PERFORM set_config('app.allow_reassign', 'off', true);

    IF v_row.phone_normalized IS NOT NULL AND v_row.phone_normalized <> '' THEN
      PERFORM public.orr_release_customer_lock(
        v_row.phone_normalized, v_prev,
        'attempt_one_' || v_kind || '_missed'
      );
    END IF;

    INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
    VALUES (v_row.id, v_prev, 'open_round_robin',
            'attempt_one_' || v_kind || '_missed_no_call');

    v_avail := public.orr_pick_available_blue_agents();
    v_new_agent := NULL;
    IF v_avail IS NOT NULL THEN
      SELECT a INTO v_new_agent FROM unnest(v_avail) AS a
      WHERE a <> v_prev LIMIT 1;
    END IF;

    IF v_new_agent IS NOT NULL THEN
      v_assigned := public.orr_assign_attempt_one(v_row.id, v_new_agent, v_kind);
      IF COALESCE((v_assigned->>'ok')::boolean, false) THEN
        v_reoffered := v_reoffered + 1;
      ELSE
        v_returned := v_returned + 1;
      END IF;
    ELSE
      v_returned := v_returned + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'missed', v_missed, 'reoffered', v_reoffered,
    'returned', v_returned, 'ran_at', now()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.orr_sweep_retry_expiries()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row       RECORD;
  v_missed    int := 0;
  v_pool      text;
BEGIN
  FOR v_row IN
    SELECT sl.id, sl.assigned_to, sl.phone_normalized,
           sl.orr_retry_deadline, sl.orr_attempt_count
    FROM public.sales_leads sl
    WHERE sl.orr_retry_deadline IS NOT NULL
      AND sl.orr_retry_deadline < now()
      AND sl.assigned_to IS NOT NULL
      AND COALESCE(sl.orr_attempt_count,0) >= 1
      AND sl.orr_pool_state IS NULL
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND public.is_agent_on_team_blue(sl.assigned_to)
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_call_logs lcl
        WHERE lcl.lead_id = sl.id::text
          AND lcl.created_at >= (sl.orr_retry_deadline - interval '5 minutes')
      )
      -- NEW: agent notes protect the lead from being pushed back into pool
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_quick_notes lqn
        WHERE lqn.lead_id = sl.id
      )
    ORDER BY sl.orr_retry_deadline ASC
    LIMIT 300
  LOOP
    v_pool := 'attempt' || (COALESCE(v_row.orr_attempt_count,0) + 1) || '_pool';

    PERFORM set_config('app.allow_reassign', 'on', true);

    UPDATE public.sales_leads
    SET orr_retry_missed_by = v_row.assigned_to,
        orr_retry_missed_at = now(),
        assigned_to = NULL,
        assigned_at = NULL,
        orr_retry_deadline = NULL,
        orr_pool_state = v_pool,
        orr_pool_kind = 'attempt_' || (COALESCE(v_row.orr_attempt_count,0) + 1),
        orr_pool_since = now()
    WHERE id = v_row.id;

    PERFORM set_config('app.allow_reassign', 'off', true);

    IF v_row.phone_normalized IS NOT NULL AND v_row.phone_normalized <> '' THEN
      PERFORM public.orr_release_customer_lock(
        v_row.phone_normalized, v_row.assigned_to,
        'retry_missed_returned_to_' || v_pool
      );
    END IF;

    INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
    VALUES (v_row.id, v_row.assigned_to, 'open_round_robin',
            'retry_missed_returned_to_' || v_pool);
    v_missed := v_missed + 1;
  END LOOP;

  RETURN jsonb_build_object('returned', v_missed, 'ran_at', now());
END; $function$;

-- 5. Open Pool reap: also skip touched leads.
CREATE OR REPLACE FUNCTION public.open_pool_reap_expired_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _rec record;
  _released integer := 0;
BEGIN
  FOR _rec IN
    SELECT id, locked_by, locked_at, first_name, last_name, phone, lead_source
      FROM sales_leads
     WHERE pool_status = 'calling_locked'
       AND locked_at IS NOT NULL
       AND locked_at < now() - interval '7 minutes'
       AND call_outcome IS NULL
       AND next_action_at IS NULL
       AND NOT public.lead_has_human_activity(id)
  LOOP
    PERFORM set_config('app.allow_reassign', 'on', true);

    UPDATE sales_leads
       SET pool_status    = 'new',
           locked_by      = NULL,
           locked_at      = NULL,
           last_action_at = now(),
           auto_tags      = (
             SELECT ARRAY(SELECT DISTINCT unnest(
               COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['recycled_to_pool']
             ))
           )
     WHERE id = _rec.id;

    PERFORM set_config('app.allow_reassign', 'off', true);

    INSERT INTO public.system_event_logs (event_type, event_source, event_data)
    VALUES ('open_pool_lock_expired', 'open_pool',
      jsonb_build_object(
        'lead_id', _rec.id, 'owner_agent', _rec.locked_by,
        'name', trim(coalesce(_rec.first_name,'') || ' ' || coalesce(_rec.last_name,'')),
        'phone', _rec.phone, 'lead_source', _rec.lead_source,
        'locked_at', _rec.locked_at
      ));
    _released := _released + 1;
  END LOOP;

  RETURN _released;
END;
$function$;
