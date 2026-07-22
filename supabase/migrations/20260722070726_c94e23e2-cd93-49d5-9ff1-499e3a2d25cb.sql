
-- Prompt 13: Real-time dialler logging

-- 1) Extend lead_call_logs with the call lifecycle + routing snapshot.
ALTER TABLE public.lead_call_logs
  ADD COLUMN IF NOT EXISTS call_started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS call_ended_at     timestamptz,
  ADD COLUMN IF NOT EXISTS team_id           uuid,
  ADD COLUMN IF NOT EXISTS phone_normalized  text,
  ADD COLUMN IF NOT EXISTS contact_made      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_eligible_at  timestamptz,
  ADD COLUMN IF NOT EXISTS new_owner_id      uuid,
  ADD COLUMN IF NOT EXISTS new_queue         text,
  ADD COLUMN IF NOT EXISTS marked_dormant    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lock_state_at_start text,
  ADD COLUMN IF NOT EXISTS lock_state_at_end   text,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_lead_call_logs_lead_started
  ON public.lead_call_logs (lead_id, call_started_at DESC);

-- 2) Start-of-call RPC: acquires the customer lock atomically.
--    Blocks any other agent from dialling before the first agent writes notes.
CREATE OR REPLACE FUNCTION public.orr_call_started(
  _lead_id uuid,
  _agent_id uuid,
  _agent_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_phone text;
  v_team_id uuid;
  v_attempt int;
  v_lock_ok boolean;
  v_log_id uuid;
BEGIN
  IF _lead_id IS NULL OR _agent_id IS NULL THEN
    RAISE EXCEPTION 'orr_call_started: lead_id and agent_id are required';
  END IF;

  SELECT phone_normalized, team_id, COALESCE(orr_attempt_count,0) + 1
    INTO v_phone, v_team_id, v_attempt
  FROM public.sales_leads WHERE id = _lead_id;

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'orr_call_started: lead % has no normalised phone', _lead_id;
  END IF;

  -- Atomic customer-level lock (blocks other agents and teams on the same number).
  v_lock_ok := public.orr_try_acquire_customer_lock(v_phone, _agent_id, _lead_id, 'dialler');
  IF NOT v_lock_ok THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'customer_locked_by_other_agent');
  END IF;

  -- Move lock into Call in Progress and stamp the sales lead.
  UPDATE public.lead_customers
  SET lock_state = 'call_in_progress',
      lock_state_at = now(),
      last_call_start = now(),
      last_attempt_at = now(),
      updated_at = now()
  WHERE phone_normalized = v_phone;

  UPDATE public.sales_leads
  SET orr_locked_until = now() + interval '30 minutes',
      updated_at = now()
  WHERE id = _lead_id;

  INSERT INTO public.lead_call_logs
    (lead_id, lead_type, attempt_number, agent_id, agent_name,
     call_started_at, phone_normalized, team_id, lock_state_at_start, created_at)
  VALUES
    (_lead_id::text, 'sales_lead', v_attempt, _agent_id, _agent_name,
     now(), v_phone, v_team_id, 'call_in_progress', now())
  RETURNING id INTO v_log_id;

  INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
  VALUES (_lead_id, _agent_id, 'open_round_robin', 'orr_call_started_attempt_' || v_attempt);

  RETURN jsonb_build_object(
    'ok', true, 'call_log_id', v_log_id,
    'attempt_number', v_attempt, 'phone_normalized', v_phone
  );
END;
$$;

-- 3) End-of-call RPC: records outcome, releases lock, saves next eligible time,
--    transfers ownership on contact, marks Dormant after Attempt 7.
CREATE OR REPLACE FUNCTION public.orr_call_ended(
  _call_log_id uuid,
  _outcome text,                            -- spoken | contacted | sale | callback_booked | no_answer | voicemail | busy | wrong_number | do_not_call | ...
  _notes text DEFAULT NULL,
  _callback_at timestamptz DEFAULT NULL,
  _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log record;
  v_lead uuid;
  v_answered boolean;
  v_new_count int;
  v_next_release timestamptz;
  v_new_status lead_status;
  v_dormant boolean := false;
BEGIN
  SELECT * INTO v_log FROM public.lead_call_logs WHERE id = _call_log_id;
  IF v_log.id IS NULL THEN
    RAISE EXCEPTION 'orr_call_ended: call log % not found', _call_log_id;
  END IF;

  BEGIN v_lead := v_log.lead_id::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'orr_call_ended: call log has non-uuid lead_id';
  END;

  v_answered := _outcome IN ('spoken','contacted','sale','sale_completed',
                             'callback_booked','interested','info_requested');

  -- If the outcome is a decisive contact outcome, delegate to the central
  -- contact-outcome handler which cancels ORR releases, transfers ownership,
  -- and cascades DNC/Wrong Number/Not Interested across duplicates.
  IF _outcome IN ('interested','callback_agreed','callback_booked','info_requested',
                  'not_interested','not_eligible','do_not_call','wrong_number',
                  'sale','sale_completed') THEN
    PERFORM public.orr_apply_contact_outcome(
      v_lead, v_log.agent_id,
      CASE _outcome
        WHEN 'callback_booked' THEN 'callback_agreed'
        WHEN 'sale' THEN 'sale_completed'
        ELSE _outcome
      END,
      _callback_at, _reason, _notes
    );
  ELSE
    -- Unanswered / non-contact outcome: increment attempt and schedule next release.
    UPDATE public.sales_leads
    SET orr_attempt_count   = orr_attempt_count + 1,
        orr_last_attempt_at = now(),
        orr_first_call_deadline = NULL,
        orr_retry_deadline  = NULL
    WHERE id = v_lead
    RETURNING orr_attempt_count INTO v_new_count;

    IF v_new_count IS NOT NULL AND v_new_count >= 7 THEN
      UPDATE public.sales_leads
      SET status = 'dormant', orr_dormant_at = now(),
          orr_next_release_at = NULL, orr_locked_until = NULL, assigned_to = NULL,
          notes = COALESCE(notes,'') || E'\n[ORR] Dormant — no contact after 7 attempts.'
      WHERE id = v_lead;
      v_dormant := true;
    ELSIF v_new_count IS NOT NULL THEN
      v_next_release := public.orr_compute_next_release(v_new_count + 1, now());
      UPDATE public.sales_leads
      SET orr_next_release_at = v_next_release,
          orr_locked_until    = v_next_release
      WHERE id = v_lead;
    END IF;
  END IF;

  -- Update the call log with end-of-call routing snapshot.
  SELECT status, assigned_to, orr_next_release_at
    INTO v_new_status, _reason, v_next_release
  FROM public.sales_leads WHERE id = v_lead;

  UPDATE public.lead_call_logs
  SET call_ended_at    = now(),
      outcome          = _outcome,
      notes            = COALESCE(notes,'') || COALESCE(E'\n' || NULLIF(_notes,''), ''),
      contact_made     = v_answered,
      next_eligible_at = v_next_release,
      new_owner_id     = _reason::uuid,
      marked_dormant   = v_dormant,
      lock_state_at_end= CASE WHEN v_answered THEN 'contacted_owned'
                              WHEN v_dormant THEN 'dormant'
                              ELSE 'cooling_off' END,
      updated_at       = now()
  WHERE id = _call_log_id;

  -- Release the customer lock now that the call is done.
  -- Successful contact → lock stays as 'contacted_owned' (set by orr_apply_contact_outcome).
  IF NOT v_answered THEN
    UPDATE public.lead_customers
    SET lock_state    = CASE WHEN v_dormant THEN 'dormant' ELSE 'cooling_off' END,
        lock_state_at = now(),
        lock_until    = v_next_release,
        last_call_end = now(),
        last_call_outcome = _outcome,
        updated_at    = now()
    WHERE phone_normalized = v_log.phone_normalized;
  ELSE
    UPDATE public.lead_customers
    SET last_call_end     = now(),
        last_call_outcome = _outcome,
        updated_at        = now()
    WHERE phone_normalized = v_log.phone_normalized;
  END IF;

  INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
  VALUES (v_lead, v_log.agent_id, 'open_round_robin',
          'orr_call_ended_' || _outcome || CASE WHEN v_dormant THEN '_dormant' ELSE '' END);

  RETURN jsonb_build_object(
    'ok', true,
    'call_log_id', _call_log_id,
    'contact_made', v_answered,
    'marked_dormant', v_dormant,
    'next_eligible_at', v_next_release,
    'new_status', v_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.orr_call_started(uuid,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orr_call_ended(uuid,text,text,timestamptz,text) TO authenticated, service_role;
