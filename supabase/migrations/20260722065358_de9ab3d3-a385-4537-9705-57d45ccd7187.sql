
-- =========================================================
-- Prompt 6: Attempt 2 (10-min wait + 5-min same-agent window + retry pool)
-- =========================================================

-- 1) Pool + miss tracking columns
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS orr_pool_state text
    CHECK (orr_pool_state IN ('attempt2_pool','attempt3_pool','attempt4_pool',
                              'attempt5_pool','attempt6_pool','attempt7_pool')),
  ADD COLUMN IF NOT EXISTS orr_pool_kind text,
  ADD COLUMN IF NOT EXISTS orr_pool_since timestamptz,
  ADD COLUMN IF NOT EXISTS orr_retry_missed_by uuid,
  ADD COLUMN IF NOT EXISTS orr_retry_missed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sl_orr_pool_state
  ON public.sales_leads(orr_pool_state, orr_pool_since)
  WHERE orr_pool_state IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sl_orr_retry_deadline
  ON public.sales_leads(orr_retry_deadline)
  WHERE orr_retry_deadline IS NOT NULL;

-- 2) Extend the Open Round Robin sweep with the Attempt 2 phases
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
  v_a2_opened int := 0;
  v_a2_pooled int := 0;
  v_agent_overnight_taken jsonb := '{}'::jsonb;
  v_enabled boolean;
BEGIN
  SELECT open_round_robin_enabled INTO v_enabled
  FROM public.lead_distribution_settings WHERE team_id = v_team_blue;

  IF v_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  -- ---------- (A) Attempt 1 — LIVE (2m) ----------
  FOR v_lead IN
    SELECT sl.id
    FROM public.sales_leads sl
    WHERE sl.team_id = v_team_blue
      AND sl.assigned_to IS NULL
      AND COALESCE(sl.orr_attempt_count,0) = 0
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND sl.orr_next_release_at IS NULL
      AND sl.orr_pool_state IS NULL
      AND COALESCE(sl.intake_class,'live') = 'live'
      AND (sl.eligible_at IS NULL OR sl.eligible_at <= now())
      AND sl.created_at >= now() - interval '7 days'
    ORDER BY sl.created_at ASC
    LIMIT 100
  LOOP
    v_avail := public.orr_pick_available_blue_agents();
    IF v_avail IS NULL OR array_length(v_avail,1) IS NULL THEN EXIT; END IF;
    v_agent := v_avail[1];
    v_res := public.orr_assign_attempt_one(v_lead.id, v_agent, 'live');
    IF COALESCE((v_res->>'ok')::boolean, false) THEN
      v_assigned_live := v_assigned_live + 1;
    END IF;
  END LOOP;

  -- ---------- (B) Attempt 1 — OVERNIGHT (5m, 1/agent) ----------
  FOR v_lead IN
    SELECT sl.id
    FROM public.sales_leads sl
    WHERE sl.team_id = v_team_blue
      AND sl.assigned_to IS NULL
      AND COALESCE(sl.orr_attempt_count,0) = 0
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND sl.orr_next_release_at IS NULL
      AND sl.orr_pool_state IS NULL
      AND sl.intake_class = 'overnight'
      AND sl.eligible_at IS NOT NULL
      AND sl.eligible_at <= now()
    ORDER BY sl.eligible_at ASC, sl.created_at ASC
    LIMIT 200
  LOOP
    v_avail := public.orr_pick_available_blue_agents();
    IF v_avail IS NULL OR array_length(v_avail,1) IS NULL THEN EXIT; END IF;
    v_agent := NULL;
    SELECT a INTO v_agent FROM unnest(v_avail) AS a
    WHERE (v_agent_overnight_taken ? a::text) = false
    LIMIT 1;
    IF v_agent IS NULL THEN EXIT; END IF;
    v_res := public.orr_assign_attempt_one(v_lead.id, v_agent, 'overnight');
    IF COALESCE((v_res->>'ok')::boolean, false) THEN
      v_agent_overnight_taken := v_agent_overnight_taken || jsonb_build_object(v_agent::text, true);
      v_assigned_overnight := v_assigned_overnight + 1;
    END IF;
  END LOOP;

  -- ---------- (C) Missed Attempt 1 timers ----------
  v_expiry := public.orr_sweep_attempt_one_expiries();

  -- ---------- (D) Attempt 2 — OPEN 5-min window for original agent ----------
  -- attempt_count = 1, still assigned to original agent, 10-min wait elapsed
  FOR v_lead IN
    SELECT sl.id, sl.assigned_to
    FROM public.sales_leads sl
    WHERE sl.team_id = v_team_blue
      AND COALESCE(sl.orr_attempt_count,0) = 1
      AND sl.assigned_to IS NOT NULL
      AND sl.orr_next_release_at IS NOT NULL
      AND sl.orr_next_release_at <= now()
      AND sl.orr_retry_deadline IS NULL
      AND sl.orr_pool_state IS NULL
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
    ORDER BY sl.orr_next_release_at ASC
    LIMIT 200
  LOOP
    UPDATE public.sales_leads
    SET orr_retry_deadline = now() + interval '5 minutes',
        orr_next_release_at = NULL,
        orr_locked_until = NULL,
        orr_first_call_notified_at = now()
    WHERE id = v_lead.id;

    INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
    VALUES (v_lead.id, v_lead.assigned_to, 'open_round_robin',
            'attempt_2_window_opened_original_agent');
    v_a2_opened := v_a2_opened + 1;
  END LOOP;

  -- ---------- (E) Attempt 2 — MISSED by original agent → move to pool ----------
  FOR v_lead IN
    SELECT sl.id, sl.assigned_to, sl.phone_normalized,
           sl.orr_retry_deadline
    FROM public.sales_leads sl
    WHERE sl.team_id = v_team_blue
      AND COALESCE(sl.orr_attempt_count,0) = 1
      AND sl.assigned_to IS NOT NULL
      AND sl.orr_retry_deadline IS NOT NULL
      AND sl.orr_retry_deadline < now()
      AND sl.orr_pool_state IS NULL
      AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_call_logs lcl
        WHERE lcl.lead_id = sl.id::text
          AND lcl.created_at >= (sl.orr_retry_deadline - interval '5 minutes')
      )
    ORDER BY sl.orr_retry_deadline ASC
    LIMIT 200
  LOOP
    UPDATE public.sales_leads
    SET orr_retry_missed_by = v_lead.assigned_to,
        orr_retry_missed_at = now(),
        assigned_to = NULL,
        assigned_at = NULL,
        orr_retry_deadline = NULL,
        orr_pool_state = 'attempt2_pool',
        orr_pool_kind = 'attempt_2',
        orr_pool_since = now()
    WHERE id = v_lead.id;

    -- Keep the customer lock but detach it from the missing agent so a
    -- new claim from the pool can transfer it cleanly.
    IF v_lead.phone_normalized IS NOT NULL AND v_lead.phone_normalized <> '' THEN
      PERFORM public.orr_release_customer_lock(
        v_lead.phone_normalized, v_lead.assigned_to,
        'attempt_2_missed_moved_to_pool'
      );
    END IF;

    INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
    VALUES (v_lead.id, v_lead.assigned_to, 'open_round_robin',
            'attempt_2_missed_moved_to_pool');
    v_a2_pooled := v_a2_pooled + 1;
  END LOOP;

  -- ---------- (F) Retry releases (attempts 3..7 only — Attempt 2 is not auto-released) ----------
  FOR v_lead IN
    SELECT sl.id, sl.lead_source, sl.orr_attempt_count
    FROM public.sales_leads sl
    WHERE sl.team_id = v_team_blue
      AND sl.orr_next_release_at IS NOT NULL
      AND sl.orr_next_release_at <= now()
      AND (sl.orr_locked_until IS NULL OR sl.orr_locked_until <= now())
      AND COALESCE(sl.orr_attempt_count,0) >= 2
      AND sl.orr_pool_state IS NULL
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
    'attempt_one_expiries', v_expiry,
    'attempt_two_windows_opened', v_a2_opened,
    'attempt_two_moved_to_pool', v_a2_pooled,
    'released_retries', v_released,
    'ran_at', now()
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.sweep_open_round_robin() TO authenticated, service_role;

-- 3) Claim a lead from the Attempt 2 retry pool
CREATE OR REPLACE FUNCTION public.orr_claim_pool_lead(
  _lead_id  uuid,
  _agent_id uuid
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
  v_avail    uuid[];
  v_ok_agent boolean := false;
BEGIN
  SELECT id, team_id, assigned_to, phone_normalized,
         orr_attempt_count, orr_pool_state, orr_pool_kind,
         orr_retry_missed_by, status
  INTO v_lead
  FROM public.sales_leads
  WHERE id = _lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lead_not_found');
  END IF;
  IF v_lead.orr_pool_state IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_pool');
  END IF;
  IF v_lead.assigned_to IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_assigned');
  END IF;
  IF COALESCE(v_lead.status::text,'') IN ('converted','lost','fake_lead','dormant','archived') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  -- Only currently-available Team Blue agents can pull from the pool
  v_avail := public.orr_pick_available_blue_agents();
  IF v_avail IS NULL OR NOT (_agent_id = ANY(v_avail)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'agent_not_available');
  END IF;

  -- Transfer the customer lock to the claiming agent
  IF v_lead.phone_normalized IS NOT NULL AND v_lead.phone_normalized <> '' THEN
    v_lock := public.orr_try_acquire_customer_lock(
      v_lead.phone_normalized, _agent_id, _lead_id,
      'pool_claim_' || v_lead.orr_pool_state
    );
    IF NOT COALESCE((v_lock->>'ok')::boolean, false) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'lock_rejected', 'lock', v_lock);
    END IF;
  END IF;

  v_deadline := now() + interval '5 minutes';

  UPDATE public.sales_leads
  SET assigned_to = _agent_id,
      assigned_at = now(),
      orr_pool_state = NULL,
      orr_pool_kind = NULL,
      orr_pool_since = NULL,
      orr_retry_deadline = v_deadline
  WHERE id = _lead_id;

  INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
  VALUES (_lead_id, _agent_id, 'open_round_robin',
          'pool_claimed_attempt_' || (COALESCE(v_lead.orr_attempt_count,0) + 1));

  RETURN jsonb_build_object(
    'ok', true,
    'agent_id', _agent_id,
    'deadline', v_deadline,
    'attempt_number', COALESCE(v_lead.orr_attempt_count,0) + 1
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.orr_claim_pool_lead(uuid,uuid) TO authenticated, service_role;

-- 4) List retry pool leads (for UI)
CREATE OR REPLACE FUNCTION public.orr_list_pool_leads(_pool_state text DEFAULT NULL)
RETURNS TABLE (
  lead_id uuid,
  pool_state text,
  attempt_number int,
  pool_since timestamptz,
  missed_by uuid,
  missed_at timestamptz,
  first_name text,
  last_name text,
  phone text,
  lead_source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sl.id,
         sl.orr_pool_state,
         COALESCE(sl.orr_attempt_count,0) + 1,
         sl.orr_pool_since,
         sl.orr_retry_missed_by,
         sl.orr_retry_missed_at,
         sl.first_name,
         sl.last_name,
         sl.phone,
         sl.lead_source::text
  FROM public.sales_leads sl
  WHERE sl.orr_pool_state IS NOT NULL
    AND (_pool_state IS NULL OR sl.orr_pool_state = _pool_state)
    AND COALESCE(sl.status::text,'') NOT IN ('converted','lost','fake_lead','dormant','archived')
  ORDER BY sl.orr_pool_since ASC NULLS LAST
  LIMIT 500
$$;

GRANT EXECUTE ON FUNCTION public.orr_list_pool_leads(text) TO authenticated, service_role;

-- 5) On any outbound call, clear pool state (defensive) — the existing
--    orr_on_call_logged trigger already bumps the attempt count and schedules
--    the next attempt; make sure a lead that receives a call is out of the pool.
CREATE OR REPLACE FUNCTION public.orr_clear_pool_on_call()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lead_uuid uuid;
BEGIN
  BEGIN v_lead_uuid := NEW.lead_id::uuid;
  EXCEPTION WHEN others THEN RETURN NEW; END;

  UPDATE public.sales_leads
  SET orr_pool_state = NULL,
      orr_pool_kind = NULL,
      orr_pool_since = NULL,
      orr_retry_deadline = NULL
  WHERE id = v_lead_uuid
    AND orr_pool_state IS NOT NULL;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_orr_clear_pool_on_call ON public.lead_call_logs;
CREATE TRIGGER trg_orr_clear_pool_on_call
BEFORE INSERT ON public.lead_call_logs
FOR EACH ROW EXECUTE FUNCTION public.orr_clear_pool_on_call();
