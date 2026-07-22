
-- Prompt 11: Contact outcomes for Open Round Robin.
-- Central RPC to apply successful contact outcomes, cancel future ORR releases,
-- remove duplicates from active queues, and lock ownership to the contacting agent.

CREATE OR REPLACE FUNCTION public.orr_apply_contact_outcome(
  _lead_id uuid,
  _agent_id uuid,
  _outcome text,               -- interested | callback_agreed | info_requested | not_interested | not_eligible | do_not_call | wrong_number | sale_completed
  _callback_at timestamptz DEFAULT NULL,
  _reason text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_phone text;
  v_new_status lead_status;
  v_note_prefix text;
  v_dnc boolean := false;
  v_closed boolean := false;
BEGIN
  IF _lead_id IS NULL OR _agent_id IS NULL OR _outcome IS NULL THEN
    RAISE EXCEPTION 'orr_apply_contact_outcome: lead_id, agent_id and outcome are required';
  END IF;

  SELECT phone_normalized INTO v_phone
  FROM public.sales_leads WHERE id = _lead_id;

  -- Map outcome → CRM status + flags
  CASE _outcome
    WHEN 'interested'      THEN v_new_status := 'contacted';        v_note_prefix := '[ORR] Contacted — In Progress';
    WHEN 'callback_agreed' THEN v_new_status := 'callback_booked';  v_note_prefix := '[ORR] Contacted — Callback Agreed';
    WHEN 'info_requested'  THEN v_new_status := 'follow_up';        v_note_prefix := '[ORR] Contacted — Follow-Up Required';
    WHEN 'not_interested'  THEN v_new_status := 'not_interested';   v_note_prefix := '[ORR] Contacted — Not Interested';       v_closed := true;
    WHEN 'not_eligible'    THEN v_new_status := 'lost';             v_note_prefix := '[ORR] Contacted — Not Eligible';         v_closed := true;
    WHEN 'do_not_call'     THEN v_new_status := 'do_not_contact';   v_note_prefix := '[ORR] Do Not Call';    v_dnc := true; v_closed := true;
    WHEN 'wrong_number'    THEN v_new_status := 'wrong_number';     v_note_prefix := '[ORR] Wrong Number';                     v_closed := true;
    WHEN 'sale_completed'  THEN v_new_status := 'converted';        v_note_prefix := '[ORR] Sale Completed';                   v_closed := true;
    ELSE RAISE EXCEPTION 'orr_apply_contact_outcome: unknown outcome %', _outcome;
  END CASE;

  -- 1) Update the contacting lead: cancel all ORR releases, set owner, status.
  UPDATE public.sales_leads
  SET status                       = v_new_status,
      assigned_to                  = _agent_id,
      orr_next_release_at          = NULL,
      orr_locked_until             = NULL,
      orr_first_call_deadline      = NULL,
      orr_retry_deadline           = NULL,
      orr_pool_state               = NULL,
      orr_pool_kind                = NULL,
      orr_pool_since               = NULL,
      orr_pool_next_open_at        = NULL,
      orr_last_attempt_at          = COALESCE(orr_last_attempt_at, now()),
      callback_at                  = CASE WHEN _outcome = 'callback_agreed' THEN _callback_at ELSE callback_at END,
      notes                        = COALESCE(notes,'') || E'\n' || v_note_prefix
                                     || COALESCE(' — ' || NULLIF(_reason,''), '')
                                     || COALESCE(' — ' || NULLIF(_notes,''),'')
                                     || CASE WHEN _outcome = 'callback_agreed' AND _callback_at IS NOT NULL
                                             THEN ' — callback ' || to_char(_callback_at AT TIME ZONE 'Europe/London','YYYY-MM-DD HH24:MI')
                                             ELSE '' END,
      updated_at                   = now()
  WHERE id = _lead_id;

  -- 2) Remove ALL duplicate records (same normalized phone) from active ORR queues.
  IF v_phone IS NOT NULL AND length(v_phone) > 0 THEN
    UPDATE public.sales_leads
    SET orr_next_release_at    = NULL,
        orr_locked_until       = NULL,
        orr_first_call_deadline= NULL,
        orr_retry_deadline     = NULL,
        orr_pool_state         = NULL,
        orr_pool_kind          = NULL,
        orr_pool_since         = NULL,
        orr_pool_next_open_at  = NULL,
        updated_at             = now()
    WHERE phone_normalized = v_phone
      AND id <> _lead_id;

    -- 3) Update the shared customer record (locks the number across teams/campaigns).
    UPDATE public.lead_customers
    SET contacted_at    = COALESCE(contacted_at, now()),
        contacted_owner = _agent_id,
        lock_state      = CASE
                            WHEN v_dnc THEN 'do_not_call'
                            WHEN v_closed THEN 'contacted_owned'
                            WHEN _outcome IN ('interested','info_requested','callback_agreed') THEN 'contacted_owned'
                            ELSE lock_state
                          END,
        lock_state_at   = now(),
        lock_owner      = _agent_id,
        lock_agent_id   = _agent_id,
        lock_lead_id    = _lead_id,
        lock_until      = NULL,
        do_not_call     = COALESCE(do_not_call,false) OR v_dnc,
        do_not_call_at  = CASE WHEN v_dnc THEN COALESCE(do_not_call_at, now()) ELSE do_not_call_at END,
        do_not_call_reason = CASE WHEN v_dnc THEN COALESCE(NULLIF(_reason,''), do_not_call_reason, 'opt_out') ELSE do_not_call_reason END,
        last_call_outcome = _outcome,
        last_attempt_at  = now(),
        updated_at       = now()
    WHERE phone_normalized = v_phone;

    -- 4) DNC / wrong_number cascade: block every duplicate lead from ever re-entering ORR.
    IF v_dnc THEN
      UPDATE public.sales_leads
      SET status = 'do_not_contact',
          notes  = COALESCE(notes,'') || E'\n[ORR] Cascaded Do Not Call from lead ' || _lead_id::text
      WHERE phone_normalized = v_phone
        AND id <> _lead_id
        AND status <> 'do_not_contact';
    END IF;

    IF _outcome = 'wrong_number' THEN
      UPDATE public.sales_leads
      SET status = 'wrong_number',
          notes  = COALESCE(notes,'') || E'\n[ORR] Cascaded Wrong Number from lead ' || _lead_id::text
      WHERE phone_normalized = v_phone
        AND id <> _lead_id
        AND status NOT IN ('wrong_number','do_not_contact','converted');
    END IF;

    IF _outcome = 'not_interested' THEN
      -- Not-interested customer cannot return to ORR (across duplicates).
      UPDATE public.sales_leads
      SET status = 'not_interested',
          notes  = COALESCE(notes,'') || E'\n[ORR] Cascaded Not Interested from lead ' || _lead_id::text
      WHERE phone_normalized = v_phone
        AND id <> _lead_id
        AND status NOT IN ('converted','do_not_contact','not_interested','wrong_number');
    END IF;
  END IF;

  -- 5) Audit trail
  INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
  VALUES (_lead_id, _agent_id, 'open_round_robin', 'orr_outcome_' || _outcome);

  RETURN jsonb_build_object(
    'ok', true,
    'lead_id', _lead_id,
    'agent_id', _agent_id,
    'outcome', _outcome,
    'status', v_new_status,
    'dnc_applied', v_dnc,
    'phone_normalized', v_phone
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.orr_apply_contact_outcome(uuid,uuid,text,timestamptz,text,text) TO authenticated, service_role;

-- Guard: leads flagged as terminal-contact statuses must never be re-scheduled by ORR.
-- Backfill safety net so any lingering releases are cancelled once outcomes exist.
UPDATE public.sales_leads
SET orr_next_release_at = NULL,
    orr_locked_until    = NULL,
    orr_pool_state      = NULL,
    orr_pool_kind       = NULL,
    orr_pool_since      = NULL,
    orr_pool_next_open_at = NULL
WHERE status IN ('converted','do_not_contact','not_interested','wrong_number','lost','callback_booked')
  AND (orr_next_release_at IS NOT NULL OR orr_pool_state IS NOT NULL);
