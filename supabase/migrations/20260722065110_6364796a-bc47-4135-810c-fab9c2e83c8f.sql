
-- =========================================================
-- Prompt 5: Attempt 1 (Live 2m / Overnight 5m) — Team Blue ORR
-- =========================================================

-- 1) Tracking columns
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS orr_first_call_kind text
    CHECK (orr_first_call_kind IN ('live','overnight')),
  ADD COLUMN IF NOT EXISTS orr_first_call_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS orr_first_call_missed_by uuid,
  ADD COLUMN IF NOT EXISTS orr_first_call_missed_at timestamptz,
  ADD COLUMN IF NOT EXISTS orr_first_call_missed_count int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sl_orr_first_call_deadline
  ON public.sales_leads(orr_first_call_deadline)
  WHERE orr_first_call_deadline IS NOT NULL AND assigned_to IS NOT NULL;

-- 2) Atomic Attempt-1 assignment: assign + lock + start timer
CREATE OR REPLACE FUNCTION public.orr_assign_attempt_one(
  _lead_id uuid,
  _agent_id uuid,
  _kind    text  -- 'live' | 'overnight'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead      RECORD;
  v_lock      jsonb;
  v_deadline  timestamptz;
  v_seconds   int;
BEGIN
  IF _kind NOT IN ('live','overnight') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  END IF;

  v_seconds := CASE WHEN _kind = 'live' THEN 120 ELSE 300 END;

  SELECT id, assigned_to, phone_normalized, status,
         COALESCE(orr_attempt_count, 0) AS attempt_count
  INTO v_lead
  FROM public.sales_leads
  WHERE id = _lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lead_not_found');
  END IF;
  IF v_lead.assigned_to IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_assigned');
  END IF;
  IF v_lead.attempt_count <> 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_attempt_one');
  END IF;
  IF COALESCE(v_lead.status::text, '') IN ('converted','lost','fake_lead','dormant','archived') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  -- Acquire customer lock (skip when we have no normalized phone)
  IF v_lead.phone_normalized IS NOT NULL AND v_lead.phone_normalized <> '' THEN
    v_lock := public.orr_try_acquire_customer_lock(
      v_lead.phone_normalized, _agent_id, _lead_id, 'attempt_one_' || _kind
    );
    IF NOT COALESCE((v_lock->>'ok')::boolean, false) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'lock_rejected', 'lock', v_lock);
    END IF;
  END IF;

  v_deadline := now() + make_interval(secs => v_seconds);

  UPDATE public.sales_leads
  SET assigned_to = _agent_id,
      assigned_at = now(),
      orr_first_call_kind = _kind,
      orr_first_call_deadline = v_deadline,
      orr_first_call_notified_at = now(),
      orr_first_call_missed_by = NULL,
      orr_first_call_missed_at = NULL
  WHERE id = _lead_id;

  INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
  VALUES (_lead_id, _agent_id, 'open_round_robin',
          'attempt_one_' || _kind || '_assigned');

  RETURN jsonb_build_object(
    'ok', true, 'kind', _kind, 'deadline', v_deadline,
    'seconds', v_seconds, 'agent_id', _agent_id
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.orr_assign_attempt_one(uuid,uuid,text) TO authenticated, service_role;

-- 3) Sweep missed Attempt-1 timers — release, reoffer, DO NOT count an attempt
CREATE OR REPLACE FUNCTION public.orr_sweep_attempt_one_expiries()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    -- Record the miss against the original agent, release the customer lock,
    -- clear the assignment and timer. Attempt count is NOT changed.
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

    -- Reoffer to next available agent (exclude the one who just missed)
    v_avail := public.orr_pick_available_blue_agents();
    v_new_agent := NULL;
    IF v_avail IS NOT NULL THEN
      SELECT a INTO v_new_agent
      FROM unnest(v_avail) AS a
      WHERE a <> v_prev
      LIMIT 1;
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
    'missed', v_missed,
    'reoffered', v_reoffered,
    'returned_to_queue', v_returned,
    'ran_at', now()
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.orr_sweep_attempt_one_expiries() TO authenticated, service_role;

-- 4) Rewrite the main sweep so Attempt 1 uses live/overnight timers,
--    respects availability, caps overnight to 1-per-agent, and delegates
--    missed-timer handling to the new expiry sweeper.
CREATE OR REPLACE FUNCTION public.sweep_open_round_robin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_blue uuid := '14f567b3-4ba3-4baa-acef-8d0de8e24b2d';
  v_lead RECORD;
  v_avail uuid[];
  v_agent uuid;
  v_res   jsonb;
  v_expiry jsonb;
  v_released int := 0;
  v_assigned_live int := 0;
  v_assigned_overnight int := 0;
  v_agent_overnight_taken jsonb := '{}'::jsonb;
  v_enabled boolean;
BEGIN
  SELECT open_round_robin_enabled INTO v_enabled
  FROM public.lead_distribution_settings WHERE team_id = v_team_blue;

  IF v_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  -- ---------- (A) Attempt 1 — LIVE leads (2m timer) ----------
  FOR v_lead IN
    SELECT sl.id, sl.lead_source
    FROM public.sales_leads sl
    WHERE sl.team_id = v_team_blue
      AND sl.assigned_to IS NULL
      AND COALESCE(sl.orr_attempt_count,0) = 0
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND sl.orr_next_release_at IS NULL
      AND COALESCE(sl.intake_class,'live') = 'live'
      AND (sl.eligible_at IS NULL OR sl.eligible_at <= now())
      AND sl.created_at >= now() - interval '7 days'
    ORDER BY sl.created_at ASC
    LIMIT 100
  LOOP
    v_avail := public.orr_pick_available_blue_agents();
    IF v_avail IS NULL OR array_length(v_avail,1) IS NULL THEN
      EXIT; -- no one to offer to
    END IF;
    v_agent := v_avail[1];
    v_res := public.orr_assign_attempt_one(v_lead.id, v_agent, 'live');
    IF COALESCE((v_res->>'ok')::boolean, false) THEN
      v_assigned_live := v_assigned_live + 1;
    END IF;
  END LOOP;

  -- ---------- (B) Attempt 1 — OVERNIGHT leads (5m timer, 1 per agent) ----------
  FOR v_lead IN
    SELECT sl.id, sl.lead_source, sl.eligible_at
    FROM public.sales_leads sl
    WHERE sl.team_id = v_team_blue
      AND sl.assigned_to IS NULL
      AND COALESCE(sl.orr_attempt_count,0) = 0
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND sl.orr_next_release_at IS NULL
      AND sl.intake_class = 'overnight'
      AND sl.eligible_at IS NOT NULL
      AND sl.eligible_at <= now()
    ORDER BY sl.eligible_at ASC, sl.created_at ASC
    LIMIT 200
  LOOP
    v_avail := public.orr_pick_available_blue_agents();
    IF v_avail IS NULL OR array_length(v_avail,1) IS NULL THEN
      EXIT;
    END IF;

    -- Cap to one overnight lead per agent per sweep pass
    v_agent := NULL;
    SELECT a INTO v_agent
    FROM unnest(v_avail) AS a
    WHERE (v_agent_overnight_taken ? a::text) = false
    LIMIT 1;

    IF v_agent IS NULL THEN
      EXIT; -- every available agent already holds one overnight lead
    END IF;

    v_res := public.orr_assign_attempt_one(v_lead.id, v_agent, 'overnight');
    IF COALESCE((v_res->>'ok')::boolean, false) THEN
      v_agent_overnight_taken := v_agent_overnight_taken || jsonb_build_object(v_agent::text, true);
      v_assigned_overnight := v_assigned_overnight + 1;
    END IF;
  END LOOP;

  -- ---------- (C) Missed Attempt 1 timers ----------
  v_expiry := public.orr_sweep_attempt_one_expiries();

  -- ---------- (D) Retry releases (attempts 2..7) ----------
  FOR v_lead IN
    SELECT sl.id, sl.lead_source, sl.orr_attempt_count
    FROM public.sales_leads sl
    WHERE sl.team_id = v_team_blue
      AND sl.orr_next_release_at IS NOT NULL
      AND sl.orr_next_release_at <= now()
      AND (sl.orr_locked_until IS NULL OR sl.orr_locked_until <= now())
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
    ORDER BY sl.orr_next_release_at ASC
    LIMIT 200
  LOOP
    v_agent := public.pick_agent_for_distribution(
      v_team_blue, COALESCE(v_lead.lead_source::text,'unknown')
    );
    IF v_agent IS NOT NULL THEN
      UPDATE public.sales_leads
      SET assigned_to = v_agent, assigned_at = now(),
          orr_next_release_at = NULL, orr_locked_until = NULL
      WHERE id = v_lead.id;
      INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
      VALUES (v_lead.id, v_agent, 'open_round_robin',
              'orr_release_attempt_' || (COALESCE(v_lead.orr_attempt_count,0) + 1));
      v_released := v_released + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'enabled', true,
    'assigned_live', v_assigned_live,
    'assigned_overnight', v_assigned_overnight,
    'released_retries', v_released,
    'attempt_one_expiries', v_expiry,
    'ran_at', now()
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.sweep_open_round_robin() TO authenticated, service_role;
