
-- Prompt 12: Agreed Callback Protection

-- 1) Trigger: prevent any code path from putting a Callback Booked lead back into ORR queues.
CREATE OR REPLACE FUNCTION public.trg_orr_guard_callback_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'callback_booked' THEN
    -- The only scheduled event for a callback lead is the agreed callback_at.
    -- ORR pools, retry deadlines, and automatic releases must stay cleared.
    NEW.orr_pool_state        := NULL;
    NEW.orr_pool_kind         := NULL;
    NEW.orr_pool_since        := NULL;
    NEW.orr_pool_next_open_at := NULL;
    NEW.orr_retry_deadline    := NULL;
    NEW.orr_first_call_deadline := NULL;
    -- Keep ownership; do not clear assigned_to.
    -- Keep orr_next_release_at NULL so the sweep never picks this up as a retry.
    IF NEW.orr_next_release_at IS DISTINCT FROM OLD.orr_next_release_at
       AND NEW.orr_next_release_at IS NOT NULL THEN
      NEW.orr_next_release_at := NULL;
    END IF;
    IF NEW.orr_locked_until IS DISTINCT FROM OLD.orr_locked_until
       AND NEW.orr_locked_until IS NOT NULL THEN
      NEW.orr_locked_until := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orr_guard_callback_lead ON public.sales_leads;
CREATE TRIGGER trg_orr_guard_callback_lead
BEFORE UPDATE ON public.sales_leads
FOR EACH ROW
WHEN (NEW.status = 'callback_booked')
EXECUTE FUNCTION public.trg_orr_guard_callback_lead();

-- Backfill: clear any stale ORR schedules on existing callback leads.
UPDATE public.sales_leads
SET orr_next_release_at = NULL,
    orr_locked_until    = NULL,
    orr_pool_state      = NULL,
    orr_pool_kind       = NULL,
    orr_pool_since      = NULL,
    orr_pool_next_open_at = NULL,
    orr_retry_deadline  = NULL,
    orr_first_call_deadline = NULL
WHERE status = 'callback_booked'
  AND (orr_next_release_at IS NOT NULL OR orr_pool_state IS NOT NULL
       OR orr_retry_deadline IS NOT NULL OR orr_first_call_deadline IS NOT NULL);

-- 2) Log a missed agreed callback: keeps owner, no attempt reset, at most one follow-up.
CREATE OR REPLACE FUNCTION public.orr_log_callback_no_answer(
  _lead_id uuid,
  _agent_id uuid,
  _follow_up_at timestamptz DEFAULT NULL,   -- optional; must be >= 2 hours from now if provided
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_status lead_status;
  v_followups_used int;
  v_new_followup timestamptz;
BEGIN
  IF _lead_id IS NULL OR _agent_id IS NULL THEN
    RAISE EXCEPTION 'orr_log_callback_no_answer: lead_id and agent_id are required';
  END IF;

  SELECT assigned_to, status,
         COALESCE((notes ~ '\[ORR\] Callback follow-up scheduled')::int, 0)
    INTO v_owner, v_status, v_followups_used
  FROM public.sales_leads
  WHERE id = _lead_id;

  IF v_status IS DISTINCT FROM 'callback_booked' THEN
    RAISE EXCEPTION 'orr_log_callback_no_answer: lead is not in callback_booked status (current: %)', v_status;
  END IF;

  IF v_owner IS DISTINCT FROM _agent_id THEN
    RAISE EXCEPTION 'orr_log_callback_no_answer: only the owning agent may log the missed callback';
  END IF;

  -- One follow-up allowed. Second miss → dormant (owner keeps history, no ORR restart).
  IF v_followups_used >= 1 THEN
    UPDATE public.sales_leads
    SET status = 'dormant',
        orr_dormant_at = now(),
        orr_next_release_at = NULL,
        orr_locked_until = NULL,
        callback_at = NULL,
        notes = COALESCE(notes,'') || E'\n[ORR] Callback follow-up also unanswered — Dormant. No ORR restart.'
             || COALESCE(' — ' || NULLIF(_notes,''),'')
    WHERE id = _lead_id;

    INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
    VALUES (_lead_id, _agent_id, 'open_round_robin', 'orr_callback_second_miss_dormant');

    RETURN jsonb_build_object('ok', true, 'action', 'dormant', 'follow_ups_used', 1);
  END IF;

  -- Schedule the single follow-up. Default = +2 hours from now, London working hours cap.
  v_new_followup := COALESCE(_follow_up_at, now() + interval '2 hours');
  IF v_new_followup < now() + interval '30 minutes' THEN
    RAISE EXCEPTION 'orr_log_callback_no_answer: follow_up_at must be at least 30 minutes in the future';
  END IF;

  UPDATE public.sales_leads
  SET callback_at = v_new_followup,
      -- Stay in callback_booked so the guard trigger keeps it out of ORR queues.
      status = 'callback_booked',
      assigned_to = _agent_id,
      orr_next_release_at = NULL,
      orr_locked_until = NULL,
      notes = COALESCE(notes,'') || E'\n[ORR] Callback — No Answer. Follow-up scheduled '
              || to_char(v_new_followup AT TIME ZONE 'Europe/London','YYYY-MM-DD HH24:MI')
              || COALESCE(' — ' || NULLIF(_notes,''),'')
  WHERE id = _lead_id;

  INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
  VALUES (_lead_id, _agent_id, 'open_round_robin', 'orr_callback_no_answer_follow_up');

  RETURN jsonb_build_object(
    'ok', true,
    'action', 'follow_up_scheduled',
    'follow_up_at', v_new_followup,
    'follow_ups_used', 1
  );
END;
$$;

-- 3) Reassign a callback lead — requires manager role or current owner.
CREATE OR REPLACE FUNCTION public.orr_reassign_callback(
  _lead_id uuid,
  _new_agent_id uuid,
  _actor_id uuid,
  _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_actor_role text;
  v_status lead_status;
BEGIN
  IF _lead_id IS NULL OR _new_agent_id IS NULL OR _actor_id IS NULL THEN
    RAISE EXCEPTION 'orr_reassign_callback: lead_id, new_agent_id and actor_id are required';
  END IF;

  SELECT assigned_to, status INTO v_owner, v_status
  FROM public.sales_leads WHERE id = _lead_id;

  IF v_status IS DISTINCT FROM 'callback_booked' THEN
    RAISE EXCEPTION 'orr_reassign_callback: lead is not a callback (current status: %)', v_status;
  END IF;

  SELECT role INTO v_actor_role
  FROM public.admin_users
  WHERE user_id = _actor_id AND COALESCE(is_active, true) = true
  LIMIT 1;

  IF NOT (
    v_actor_role IN ('admin','super_admin','sales_manager')
    OR _actor_id = v_owner
  ) THEN
    RAISE EXCEPTION 'orr_reassign_callback: only a manager or the current owner may reassign a callback lead';
  END IF;

  UPDATE public.sales_leads
  SET assigned_to = _new_agent_id,
      notes = COALESCE(notes,'') || E'\n[ORR] Callback reassigned by '
              || _actor_id::text || ' → ' || _new_agent_id::text
              || COALESCE(' — ' || NULLIF(_reason,''),''),
      updated_at = now()
  WHERE id = _lead_id;

  -- Move the shared-customer lock to the new owner (block other agents/teams from calling).
  UPDATE public.lead_customers lc
  SET lock_owner    = _new_agent_id,
      lock_agent_id = _new_agent_id,
      lock_lead_id  = _lead_id,
      lock_state    = 'contacted_owned',
      lock_state_at = now(),
      contacted_owner = _new_agent_id,
      updated_at    = now()
  FROM public.sales_leads sl
  WHERE sl.id = _lead_id
    AND sl.phone_normalized = lc.phone_normalized;

  INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
  VALUES (_lead_id, _new_agent_id, 'open_round_robin',
          'orr_callback_reassigned_by_' || COALESCE(v_actor_role,'owner'));

  RETURN jsonb_build_object('ok', true, 'new_owner', _new_agent_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.orr_log_callback_no_answer(uuid,uuid,timestamptz,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orr_reassign_callback(uuid,uuid,uuid,text) TO authenticated, service_role;
