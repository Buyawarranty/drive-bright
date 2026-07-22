
-- =========================================================
-- Prompt 7: Fixed Retry Queues (Morning / Lunchtime / Evening)
-- =========================================================

-- Which retry queue is currently open, and its cutoffs
CREATE OR REPLACE FUNCTION public.orr_current_retry_queue()
RETURNS TABLE (
  queue_name text,
  opens_at timestamptz,
  final_assign_at timestamptz,
  closes_at timestamptz,
  can_assign boolean,   -- opens_at <= now() <= final_assign_at
  is_open boolean       -- opens_at <= now() < closes_at
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ldn_now timestamp;
  d date;
  q_name text;
  o time; f time; c time;
  o_ts timestamptz; f_ts timestamptz; c_ts timestamptz;
BEGIN
  ldn_now := (now() AT TIME ZONE 'Europe/London');
  d := ldn_now::date;

  IF ldn_now::time >= time '09:30' AND ldn_now::time < time '10:15' THEN
    q_name := 'morning'; o := '09:30'; f := '10:10'; c := '10:15';
  ELSIF ldn_now::time >= time '13:00' AND ldn_now::time < time '13:45' THEN
    q_name := 'lunchtime'; o := '13:00'; f := '13:40'; c := '13:45';
  ELSIF ldn_now::time >= time '17:00' AND ldn_now::time < time '17:50' THEN
    q_name := 'evening'; o := '17:00'; f := '17:45'; c := '17:50';
  ELSE
    RETURN;
  END IF;

  o_ts := (d + o) AT TIME ZONE 'Europe/London';
  f_ts := (d + f) AT TIME ZONE 'Europe/London';
  c_ts := (d + c) AT TIME ZONE 'Europe/London';

  queue_name := q_name;
  opens_at   := o_ts;
  final_assign_at := f_ts;
  closes_at  := c_ts;
  can_assign := now() >= o_ts AND now() <= f_ts;
  is_open    := now() >= o_ts AND now() <  c_ts;
  RETURN NEXT;
END; $$;

GRANT EXECUTE ON FUNCTION public.orr_current_retry_queue() TO authenticated, service_role;

-- Atomic retry assignment: lock + assign + 5-minute start timer
CREATE OR REPLACE FUNCTION public.orr_assign_retry(
  _lead_id  uuid,
  _agent_id uuid,
  _queue    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead     RECORD;
  v_lock     jsonb;
  v_deadline timestamptz;
BEGIN
  SELECT id, assigned_to, phone_normalized, status, orr_attempt_count
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
  IF COALESCE(v_lead.orr_attempt_count,0) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_retry_stage');
  END IF;
  IF COALESCE(v_lead.status::text,'') IN ('converted','lost','fake_lead','dormant','archived') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  IF v_lead.phone_normalized IS NOT NULL AND v_lead.phone_normalized <> '' THEN
    v_lock := public.orr_try_acquire_customer_lock(
      v_lead.phone_normalized, _agent_id, _lead_id,
      'retry_' || COALESCE(_queue,'queue')
    );
    IF NOT COALESCE((v_lock->>'ok')::boolean, false) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'lock_rejected', 'lock', v_lock);
    END IF;
  END IF;

  v_deadline := now() + interval '5 minutes';

  UPDATE public.sales_leads
  SET assigned_to = _agent_id,
      assigned_at = now(),
      orr_retry_deadline = v_deadline,
      orr_next_release_at = NULL,
      orr_locked_until = NULL,
      orr_pool_state = NULL,
      orr_pool_kind = NULL,
      orr_pool_since = NULL
  WHERE id = _lead_id;

  INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
  VALUES (_lead_id, _agent_id, 'open_round_robin',
          'retry_assigned_' || COALESCE(_queue,'queue')
          || '_attempt_' || (COALESCE(v_lead.orr_attempt_count,0) + 1));

  RETURN jsonb_build_object(
    'ok', true, 'agent_id', _agent_id, 'deadline', v_deadline,
    'queue', _queue,
    'attempt_number', COALESCE(v_lead.orr_attempt_count,0) + 1
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.orr_assign_retry(uuid,uuid,text) TO authenticated, service_role;

-- Sweep missed retry timers (attempts 2..7): return to the current queue's pool,
-- release the customer lock, DO NOT change the attempt number.
CREATE OR REPLACE FUNCTION public.orr_sweep_retry_expiries()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    ORDER BY sl.orr_retry_deadline ASC
    LIMIT 300
  LOOP
    v_pool := 'attempt' || (COALESCE(v_row.orr_attempt_count,0) + 1) || '_pool';

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
END; $$;

GRANT EXECUTE ON FUNCTION public.orr_sweep_retry_expiries() TO authenticated, service_role;

-- Main sweep: bring the fixed retry queues into the flow
CREATE OR REPLACE FUNCTION public.sweep_open_round_robin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_blue uuid := '14f567b3-4ba3-4baa-acef-8d0de8e24b2d';
  v_lead RECORD;
  v_avail uuid[];
  v_agent uuid;
  v_res   jsonb;
  v_expiry_a1 jsonb;
  v_expiry_r  jsonb;
  v_assigned_live int := 0;
  v_assigned_overnight int := 0;
  v_a2_opened int := 0;
  v_a2_pooled int := 0;
  v_retry_assigned int := 0;
  v_agent_overnight_taken jsonb := '{}'::jsonb;
  v_enabled boolean;
  v_q RECORD;
  v_avail_idx int;
BEGIN
  SELECT open_round_robin_enabled INTO v_enabled
  FROM public.lead_distribution_settings WHERE team_id = v_team_blue;

  IF v_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  -- (A) Attempt 1 LIVE
  FOR v_lead IN
    SELECT sl.id FROM public.sales_leads sl
    WHERE sl.team_id = v_team_blue
      AND sl.assigned_to IS NULL
      AND COALESCE(sl.orr_attempt_count,0) = 0
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND sl.orr_next_release_at IS NULL
      AND sl.orr_pool_state IS NULL
      AND COALESCE(sl.intake_class,'live') = 'live'
      AND (sl.eligible_at IS NULL OR sl.eligible_at <= now())
      AND sl.created_at >= now() - interval '7 days'
    ORDER BY sl.created_at ASC LIMIT 100
  LOOP
    v_avail := public.orr_pick_available_blue_agents();
    IF v_avail IS NULL OR array_length(v_avail,1) IS NULL THEN EXIT; END IF;
    v_res := public.orr_assign_attempt_one(v_lead.id, v_avail[1], 'live');
    IF COALESCE((v_res->>'ok')::boolean, false) THEN
      v_assigned_live := v_assigned_live + 1;
    END IF;
  END LOOP;

  -- (B) Attempt 1 OVERNIGHT (1/agent)
  FOR v_lead IN
    SELECT sl.id FROM public.sales_leads sl
    WHERE sl.team_id = v_team_blue
      AND sl.assigned_to IS NULL
      AND COALESCE(sl.orr_attempt_count,0) = 0
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND sl.orr_next_release_at IS NULL
      AND sl.orr_pool_state IS NULL
      AND sl.intake_class = 'overnight'
      AND sl.eligible_at IS NOT NULL AND sl.eligible_at <= now()
    ORDER BY sl.eligible_at ASC, sl.created_at ASC LIMIT 200
  LOOP
    v_avail := public.orr_pick_available_blue_agents();
    IF v_avail IS NULL OR array_length(v_avail,1) IS NULL THEN EXIT; END IF;
    v_agent := NULL;
    SELECT a INTO v_agent FROM unnest(v_avail) AS a
    WHERE (v_agent_overnight_taken ? a::text) = false LIMIT 1;
    IF v_agent IS NULL THEN EXIT; END IF;
    v_res := public.orr_assign_attempt_one(v_lead.id, v_agent, 'overnight');
    IF COALESCE((v_res->>'ok')::boolean, false) THEN
      v_agent_overnight_taken := v_agent_overnight_taken || jsonb_build_object(v_agent::text, true);
      v_assigned_overnight := v_assigned_overnight + 1;
    END IF;
  END LOOP;

  -- (C) Missed Attempt 1 timers
  v_expiry_a1 := public.orr_sweep_attempt_one_expiries();

  -- (D) Attempt 2 — open 5-min original-agent window
  FOR v_lead IN
    SELECT sl.id, sl.assigned_to FROM public.sales_leads sl
    WHERE sl.team_id = v_team_blue
      AND COALESCE(sl.orr_attempt_count,0) = 1
      AND sl.assigned_to IS NOT NULL
      AND sl.orr_next_release_at IS NOT NULL AND sl.orr_next_release_at <= now()
      AND sl.orr_retry_deadline IS NULL
      AND sl.orr_pool_state IS NULL
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
    ORDER BY sl.orr_next_release_at ASC LIMIT 200
  LOOP
    UPDATE public.sales_leads
    SET orr_retry_deadline = now() + interval '5 minutes',
        orr_next_release_at = NULL, orr_locked_until = NULL,
        orr_first_call_notified_at = now()
    WHERE id = v_lead.id;
    INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
    VALUES (v_lead.id, v_lead.assigned_to, 'open_round_robin',
            'attempt_2_window_opened_original_agent');
    v_a2_opened := v_a2_opened + 1;
  END LOOP;

  -- (E) Missed retry timers → back to the appropriate pool
  v_expiry_r := public.orr_sweep_retry_expiries();

  -- Count attempt-2 pool moves for reporting (subset of (E))
  SELECT COUNT(*) INTO v_a2_pooled
  FROM public.sales_leads
  WHERE orr_pool_state = 'attempt2_pool'
    AND orr_pool_since >= now() - interval '30 seconds';

  -- (F) FIXED RETRY QUEUES — one lead per available agent, only inside windows
  SELECT * INTO v_q FROM public.orr_current_retry_queue() LIMIT 1;

  IF v_q.queue_name IS NOT NULL AND v_q.can_assign THEN
    v_avail := public.orr_pick_available_blue_agents();
    v_avail_idx := 1;

    IF v_avail IS NOT NULL AND array_length(v_avail,1) IS NOT NULL THEN
      FOR v_lead IN
        SELECT sl.id, sl.orr_pool_since, sl.orr_next_release_at, sl.orr_attempt_count
        FROM public.sales_leads sl
        WHERE sl.team_id = v_team_blue
          AND sl.assigned_to IS NULL
          AND COALESCE(sl.orr_attempt_count,0) >= 1
          AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
          AND (
            -- either sitting in a retry pool
            sl.orr_pool_state IS NOT NULL
            -- or its scheduled release time has landed
            OR (sl.orr_next_release_at IS NOT NULL
                AND sl.orr_next_release_at <= now()
                AND (sl.orr_locked_until IS NULL OR sl.orr_locked_until <= now()))
          )
        ORDER BY COALESCE(sl.orr_pool_since, sl.orr_next_release_at) ASC
        LIMIT 500
      LOOP
        EXIT WHEN v_avail_idx > COALESCE(array_length(v_avail,1),0);
        v_res := public.orr_assign_retry(v_lead.id, v_avail[v_avail_idx], v_q.queue_name);
        IF COALESCE((v_res->>'ok')::boolean, false) THEN
          v_retry_assigned := v_retry_assigned + 1;
          v_avail_idx := v_avail_idx + 1;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'enabled', true,
    'assigned_live', v_assigned_live,
    'assigned_overnight', v_assigned_overnight,
    'attempt_one_expiries', v_expiry_a1,
    'attempt_two_windows_opened', v_a2_opened,
    'attempt_two_pooled_recent', v_a2_pooled,
    'retry_expiries', v_expiry_r,
    'retry_assigned', v_retry_assigned,
    'active_queue', to_jsonb(v_q),
    'ran_at', now()
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.sweep_open_round_robin() TO authenticated, service_role;
