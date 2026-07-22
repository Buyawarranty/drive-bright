
-- =========================================================
-- Prompt 8 (fix): Queue Ordering, Rollover, Team Blue helper
-- =========================================================

-- 1) Schema
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS orr_pool_next_open_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sl_orr_pool_next_open_at
  ON public.sales_leads(orr_pool_next_open_at)
  WHERE orr_pool_state IS NOT NULL;

-- 2) Team Blue source helper (sales_leads has no team_id column)
CREATE OR REPLACE FUNCTION public.orr_is_team_blue_source(_source text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lead_team_source_rules r
    WHERE r.team_id = '14f567b3-4ba3-4baa-acef-8d0de8e24b2d'::uuid
      AND r.allowed = true
      AND r.source = COALESCE(_source,'unknown')
  );
$$;

GRANT EXECUTE ON FUNCTION public.orr_is_team_blue_source(text) TO authenticated, service_role;

-- 3) Rollover
CREATE OR REPLACE FUNCTION public.orr_rollover_uncalled_queues()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ldn_now timestamp := (now() AT TIME ZONE 'Europe/London');
  d date := ldn_now::date;
  t time := ldn_now::time;
  next_bd date;
  target  timestamptz;
  moved_m int := 0; moved_l int := 0; moved_e int := 0;
BEGIN
  IF t >= time '10:15' AND t < time '13:00' THEN
    target := (d + time '13:00') AT TIME ZONE 'Europe/London';
    WITH upd AS (
      UPDATE public.sales_leads
      SET orr_pool_next_open_at = target
      WHERE orr_pool_state IS NOT NULL
        AND assigned_to IS NULL
        AND (orr_pool_next_open_at IS NULL OR orr_pool_next_open_at < target)
        AND COALESCE(status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      RETURNING id
    )
    SELECT COUNT(*) INTO moved_m FROM upd;
  END IF;

  IF t >= time '13:45' AND t < time '17:00' THEN
    target := (d + time '17:00') AT TIME ZONE 'Europe/London';
    WITH upd AS (
      UPDATE public.sales_leads
      SET orr_pool_next_open_at = target
      WHERE orr_pool_state IS NOT NULL
        AND assigned_to IS NULL
        AND (orr_pool_next_open_at IS NULL OR orr_pool_next_open_at < target)
        AND COALESCE(status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      RETURNING id
    )
    SELECT COUNT(*) INTO moved_l FROM upd;
  END IF;

  IF t >= time '17:50' OR t < time '09:30' THEN
    IF t >= time '17:50' THEN
      next_bd := public.orr_add_business_days(d, 1);
    ELSE
      IF public.orr_is_business_day(d) THEN
        next_bd := d;
      ELSE
        next_bd := (public.orr_next_business_open(d))::date;
      END IF;
    END IF;
    target := (next_bd + time '09:30') AT TIME ZONE 'Europe/London';
    WITH upd AS (
      UPDATE public.sales_leads
      SET orr_pool_next_open_at = target
      WHERE orr_pool_state IS NOT NULL
        AND assigned_to IS NULL
        AND (orr_pool_next_open_at IS NULL OR orr_pool_next_open_at < target)
        AND COALESCE(status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      RETURNING id
    )
    SELECT COUNT(*) INTO moved_e FROM upd;
  END IF;

  RETURN jsonb_build_object(
    'rolled_morning_to_lunchtime', moved_m,
    'rolled_lunchtime_to_evening', moved_l,
    'rolled_evening_to_next_day',  moved_e,
    'ran_at', now()
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.orr_rollover_uncalled_queues() TO authenticated, service_role;

-- 4) Top-of-queue lookup (plpgsql to avoid strict SQL body validation on shared columns)
CREATE OR REPLACE FUNCTION public.orr_next_retry_lead()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_can_assign boolean;
BEGIN
  SELECT can_assign INTO v_can_assign
  FROM public.orr_current_retry_queue() LIMIT 1;
  IF NOT COALESCE(v_can_assign, false) THEN
    RETURN NULL;
  END IF;

  SELECT sl.id INTO v_id
  FROM public.sales_leads sl
  WHERE sl.assigned_to IS NULL
    AND COALESCE(sl.orr_attempt_count,0) >= 1
    AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
    AND public.orr_is_team_blue_source(sl.lead_source::text)
    AND (
      sl.orr_pool_state IS NOT NULL
      OR (sl.orr_next_release_at IS NOT NULL
          AND sl.orr_next_release_at <= now()
          AND (sl.orr_locked_until IS NULL OR sl.orr_locked_until <= now()))
    )
    AND (sl.orr_pool_next_open_at IS NULL OR sl.orr_pool_next_open_at <= now())
  ORDER BY
    COALESCE(sl.orr_pool_next_open_at, sl.orr_next_release_at, sl.orr_pool_since, sl.created_at) ASC,
    sl.orr_attempt_count ASC,
    sl.orr_pool_since ASC NULLS LAST,
    sl.created_at ASC
  LIMIT 1;

  RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.orr_next_retry_lead() TO authenticated, service_role;

-- 5) No cherry-picking
CREATE OR REPLACE FUNCTION public.orr_claim_pool_lead(_lead_id uuid, _agent_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lead RECORD; v_lock jsonb; v_deadline timestamptz;
  v_avail uuid[]; v_top uuid;
BEGIN
  v_top := public.orr_next_retry_lead();
  IF v_top IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'queue_empty_or_closed');
  END IF;
  IF v_top <> _lead_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_top_of_queue', 'next_lead_id', v_top);
  END IF;

  SELECT id, assigned_to, phone_normalized, status, orr_attempt_count, orr_pool_state
  INTO v_lead FROM public.sales_leads WHERE id = _lead_id FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'lead_not_found'); END IF;
  IF v_lead.assigned_to IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_assigned');
  END IF;

  v_avail := public.orr_pick_available_blue_agents();
  IF v_avail IS NULL OR NOT (_agent_id = ANY(v_avail)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'agent_not_available');
  END IF;

  IF v_lead.phone_normalized IS NOT NULL AND v_lead.phone_normalized <> '' THEN
    v_lock := public.orr_try_acquire_customer_lock(
      v_lead.phone_normalized, _agent_id, _lead_id,
      'pool_claim_' || COALESCE(v_lead.orr_pool_state,'retry')
    );
    IF NOT COALESCE((v_lock->>'ok')::boolean, false) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'lock_rejected', 'lock', v_lock);
    END IF;
  END IF;

  v_deadline := now() + interval '5 minutes';

  UPDATE public.sales_leads
  SET assigned_to = _agent_id, assigned_at = now(),
      orr_pool_state = NULL, orr_pool_kind = NULL,
      orr_pool_since = NULL, orr_pool_next_open_at = NULL,
      orr_retry_deadline = v_deadline
  WHERE id = _lead_id;

  INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
  VALUES (_lead_id, _agent_id, 'open_round_robin',
          'pool_claimed_attempt_' || (COALESCE(v_lead.orr_attempt_count,0) + 1));

  RETURN jsonb_build_object(
    'ok', true, 'agent_id', _agent_id, 'deadline', v_deadline,
    'attempt_number', COALESCE(v_lead.orr_attempt_count,0) + 1
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.orr_claim_pool_lead(uuid,uuid) TO authenticated, service_role;

-- 6) Sweep — rollover first + strict ordering + fixed team-source filter
CREATE OR REPLACE FUNCTION public.sweep_open_round_robin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_blue uuid := '14f567b3-4ba3-4baa-acef-8d0de8e24b2d';
  v_lead RECORD; v_avail uuid[]; v_agent uuid; v_res jsonb;
  v_expiry_a1 jsonb; v_expiry_r jsonb; v_rollover jsonb;
  v_assigned_live int := 0; v_assigned_overnight int := 0;
  v_a2_opened int := 0; v_retry_assigned int := 0;
  v_agent_overnight_taken jsonb := '{}'::jsonb;
  v_enabled boolean; v_q RECORD; v_avail_idx int;
BEGIN
  SELECT open_round_robin_enabled INTO v_enabled
  FROM public.lead_distribution_settings WHERE team_id = v_team_blue;
  IF v_enabled IS NOT TRUE THEN RETURN jsonb_build_object('enabled', false); END IF;

  v_rollover := public.orr_rollover_uncalled_queues();

  -- (A) Attempt 1 LIVE
  FOR v_lead IN
    SELECT sl.id FROM public.sales_leads sl
    WHERE sl.assigned_to IS NULL
      AND COALESCE(sl.orr_attempt_count,0) = 0
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND sl.orr_next_release_at IS NULL
      AND sl.orr_pool_state IS NULL
      AND COALESCE(sl.intake_class,'live') = 'live'
      AND (sl.eligible_at IS NULL OR sl.eligible_at <= now())
      AND sl.created_at >= now() - interval '7 days'
      AND public.orr_is_team_blue_source(sl.lead_source::text)
    ORDER BY sl.created_at ASC LIMIT 100
  LOOP
    v_avail := public.orr_pick_available_blue_agents();
    IF v_avail IS NULL OR array_length(v_avail,1) IS NULL THEN EXIT; END IF;
    v_res := public.orr_assign_attempt_one(v_lead.id, v_avail[1], 'live');
    IF COALESCE((v_res->>'ok')::boolean, false) THEN v_assigned_live := v_assigned_live + 1; END IF;
  END LOOP;

  -- (B) Attempt 1 OVERNIGHT
  FOR v_lead IN
    SELECT sl.id FROM public.sales_leads sl
    WHERE sl.assigned_to IS NULL
      AND COALESCE(sl.orr_attempt_count,0) = 0
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND sl.orr_next_release_at IS NULL
      AND sl.orr_pool_state IS NULL
      AND sl.intake_class = 'overnight'
      AND sl.eligible_at IS NOT NULL AND sl.eligible_at <= now()
      AND public.orr_is_team_blue_source(sl.lead_source::text)
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

  v_expiry_a1 := public.orr_sweep_attempt_one_expiries();

  -- (D) Attempt 2 open same-agent window
  FOR v_lead IN
    SELECT sl.id, sl.assigned_to FROM public.sales_leads sl
    WHERE COALESCE(sl.orr_attempt_count,0) = 1
      AND sl.assigned_to IS NOT NULL
      AND sl.orr_next_release_at IS NOT NULL AND sl.orr_next_release_at <= now()
      AND sl.orr_retry_deadline IS NULL
      AND sl.orr_pool_state IS NULL
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND public.is_agent_on_team_blue(sl.assigned_to)
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

  v_expiry_r := public.orr_sweep_retry_expiries();

  -- (F) Fixed retry queues — strict ordering
  SELECT * INTO v_q FROM public.orr_current_retry_queue() LIMIT 1;
  IF v_q.queue_name IS NOT NULL AND v_q.can_assign THEN
    v_avail := public.orr_pick_available_blue_agents();
    v_avail_idx := 1;
    IF v_avail IS NOT NULL AND array_length(v_avail,1) IS NOT NULL THEN
      FOR v_lead IN
        SELECT sl.id FROM public.sales_leads sl
        WHERE sl.assigned_to IS NULL
          AND COALESCE(sl.orr_attempt_count,0) >= 1
          AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
          AND public.orr_is_team_blue_source(sl.lead_source::text)
          AND (
            sl.orr_pool_state IS NOT NULL
            OR (sl.orr_next_release_at IS NOT NULL
                AND sl.orr_next_release_at <= now()
                AND (sl.orr_locked_until IS NULL OR sl.orr_locked_until <= now()))
          )
          AND (sl.orr_pool_next_open_at IS NULL OR sl.orr_pool_next_open_at <= now())
        ORDER BY
          COALESCE(sl.orr_pool_next_open_at, sl.orr_next_release_at, sl.orr_pool_since, sl.created_at) ASC,
          sl.orr_attempt_count ASC,
          sl.orr_pool_since ASC NULLS LAST,
          sl.created_at ASC
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
    'rollover', v_rollover,
    'assigned_live', v_assigned_live,
    'assigned_overnight', v_assigned_overnight,
    'attempt_one_expiries', v_expiry_a1,
    'attempt_two_windows_opened', v_a2_opened,
    'retry_expiries', v_expiry_r,
    'retry_assigned', v_retry_assigned,
    'active_queue', to_jsonb(v_q),
    'ran_at', now()
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.sweep_open_round_robin() TO authenticated, service_role;
