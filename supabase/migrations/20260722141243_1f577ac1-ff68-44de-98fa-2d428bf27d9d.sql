
-- Round Robin agents on Team Blue must keep their leads: no 2-minute speed-to-dial
-- expiry, no reassignment. Only Open Round Robin agents are subject to the ORR clock.

CREATE OR REPLACE FUNCTION public.orr_agent_is_orr_mode(_agent uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT adc.assignment_mode = 'open_round_robin'
       FROM public.agent_distribution_caps adc
      WHERE adc.admin_user_id = _agent
      LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.orr_set_first_call_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
     AND public.is_agent_on_team_blue(NEW.assigned_to)
     AND public.orr_agent_is_orr_mode(NEW.assigned_to)
  THEN
    NEW.orr_first_call_deadline := now() + interval '2 minutes';
    NEW.orr_retry_deadline      := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.orr_sweep_attempt_one_expiries()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      -- CRITICAL: Only Open Round Robin agents are subject to the 2-min expiry.
      -- Round Robin agents keep their leads; strip the deadline instead.
      AND public.orr_agent_is_orr_mode(sl.assigned_to)
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_call_logs lcl
        WHERE lcl.lead_id = sl.id::text
          AND lcl.created_at >= COALESCE(sl.assigned_at, now() - interval '1 day')
      )
    ORDER BY sl.orr_first_call_deadline ASC
    LIMIT 200
  LOOP
    v_prev := v_row.assigned_to;
    v_kind := COALESCE(v_row.orr_first_call_kind, 'live');
    v_missed := v_missed + 1;

    UPDATE public.sales_leads
    SET assigned_to = NULL,
        assigned_at = NULL,
        orr_first_call_deadline = NULL,
        orr_first_call_notified_at = NULL,
        orr_first_call_missed_by = v_prev,
        orr_first_call_missed_at = now(),
        orr_first_call_missed_count = COALESCE(orr_first_call_missed_count,0) + 1
    WHERE id = v_row.id;

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

  -- Housekeeping: any stray deadline on a RR-mode agent's lead gets cleared so
  -- the sweep never revisits it.
  UPDATE public.sales_leads sl
  SET orr_first_call_deadline = NULL
  WHERE sl.orr_first_call_deadline IS NOT NULL
    AND sl.assigned_to IS NOT NULL
    AND public.is_agent_on_team_blue(sl.assigned_to)
    AND NOT public.orr_agent_is_orr_mode(sl.assigned_to);

  RETURN jsonb_build_object(
    'missed', v_missed,
    'reoffered', v_reoffered,
    'returned_to_queue', v_returned,
    'ran_at', now()
  );
END; $$;

-- Restore the four leads that were just stripped from Freddie / sales@ (both RR mode).
-- Freddie = d48ba5c6-999d-4ae1-b9bf-1a16120cd202
-- sales@  = 11d69be2-1f6d-4c53-af82-5aad73e1552a
UPDATE public.sales_leads
SET assigned_to = 'd48ba5c6-999d-4ae1-b9bf-1a16120cd202',
    assigned_at = COALESCE(assigned_at, now()),
    orr_first_call_deadline = NULL,
    orr_first_call_missed_by = NULL,
    orr_first_call_missed_at = NULL,
    queue = 'owned_by_agent'
WHERE id IN ('3dc5238a-9244-43cf-bf4f-c4f2cc976ce3',
             'b8f3e7fb-725e-406f-abc8-7d76d08e375b',
             'cba26edd-f7af-4734-8bd7-e4ac8ed05e37')
  AND assigned_to IS NULL;

UPDATE public.sales_leads
SET assigned_to = '11d69be2-1f6d-4c53-af82-5aad73e1552a',
    assigned_at = COALESCE(assigned_at, now()),
    orr_first_call_deadline = NULL,
    orr_first_call_missed_by = NULL,
    orr_first_call_missed_at = NULL,
    queue = 'owned_by_agent'
WHERE id = '9b14ce05-8c63-47a4-a99b-8889be6347ff'
  AND assigned_to IS NULL;

-- Wait — audit shows Kirsty (cba26edd) and Shamsur (9b14ce05) missed by different
-- agents. Correct restoration based on audit history: whoever was the last
-- "missed_by" holder gets the lead back. Redo precisely using audit.
UPDATE public.sales_leads sl
SET assigned_to = a.assigned_to_id,
    assigned_at = COALESCE(sl.assigned_at, now()),
    orr_first_call_deadline = NULL,
    orr_first_call_missed_by = NULL,
    orr_first_call_missed_at = NULL,
    queue = 'owned_by_agent'
FROM (
  SELECT DISTINCT ON (lead_id) lead_id, assigned_to_id
  FROM public.lead_assignment_audit
  WHERE lead_id IN ('cba26edd-f7af-4734-8bd7-e4ac8ed05e37',
                    '9b14ce05-8c63-47a4-a99b-8889be6347ff',
                    '3dc5238a-9244-43cf-bf4f-c4f2cc976ce3',
                    'b8f3e7fb-725e-406f-abc8-7d76d08e375b')
    AND reason LIKE 'attempt_one_%_missed_no_call'
  ORDER BY lead_id, created_at DESC
) a
WHERE sl.id = a.lead_id;

INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
SELECT id, assigned_to, 'manual_restore', 'rr_mode_lead_restored_after_orr_strip'
FROM public.sales_leads
WHERE id IN ('cba26edd-f7af-4734-8bd7-e4ac8ed05e37',
             '9b14ce05-8c63-47a4-a99b-8889be6347ff',
             '3dc5238a-9244-43cf-bf4f-c4f2cc976ce3',
             'b8f3e7fb-725e-406f-abc8-7d76d08e375b')
  AND assigned_to IS NOT NULL;
