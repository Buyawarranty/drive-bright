-- 1. Never-ending release ladder: attempts 8+ repeat every 3 business days at 10:00
CREATE OR REPLACE FUNCTION public.orr_compute_next_release(_next_attempt_number integer, _last_attempt_at timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg       public.orr_config%ROWTYPE;
  ldn_last    timestamp;
  ldn_date    date;
  target_date date;
  target_ldn  timestamp;
  v_candidate timestamptz;
  v_local     timestamp;
BEGIN
  SELECT * INTO v_cfg FROM public.orr_config WHERE id = true;
  ldn_last := (_last_attempt_at AT TIME ZONE v_cfg.timezone);
  ldn_date := ldn_last::date;

  IF _next_attempt_number <= 1 THEN
    RETURN NULL;
  ELSIF _next_attempt_number = 2 THEN
    v_candidate := _last_attempt_at + interval '10 minutes';
  ELSIF _next_attempt_number = 3 THEN
    IF ldn_last::time <= time '15:30' THEN
      target_ldn := ldn_date + time '17:30';
    ELSE
      target_date := public.orr_add_business_days(ldn_date, 1);
      target_ldn := target_date + time '10:00';
    END IF;
    v_candidate := target_ldn AT TIME ZONE v_cfg.timezone;
  ELSIF _next_attempt_number = 4 THEN
    target_date := public.orr_add_business_days(ldn_date, 1);
    v_candidate := (target_date + time '10:00') AT TIME ZONE v_cfg.timezone;
  ELSIF _next_attempt_number = 5 THEN
    target_date := public.orr_add_business_days(ldn_date, 2);
    v_candidate := (target_date + time '13:00') AT TIME ZONE v_cfg.timezone;
  ELSIF _next_attempt_number = 6 THEN
    target_date := public.orr_add_business_days(ldn_date, 2);
    v_candidate := (target_date + time '17:30') AT TIME ZONE v_cfg.timezone;
  ELSE
    -- Attempt 7 and beyond: keep trying forever, every 3 business days at 10:00
    target_date := public.orr_add_business_days(ldn_date, 3);
    v_candidate := (target_date + time '10:00') AT TIME ZONE v_cfg.timezone;
  END IF;

  v_local := (v_candidate AT TIME ZONE v_cfg.timezone);
  IF NOT public.orr_is_business_day(v_local::date)
     OR v_local::time < v_cfg.work_start
     OR v_local::time >= v_cfg.work_end THEN
    v_candidate := public.orr_next_business_open(v_candidate);
  END IF;
  RETURN v_candidate;
END; $function$;

-- 2. Trigger: no auto-dormancy
CREATE OR REPLACE FUNCTION public.orr_on_call_logged()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_blue uuid := '14f567b3-4ba3-4baa-acef-8d0de8e24b2d';
  v_lead_uuid uuid; v_is_blue boolean; v_answered boolean;
  v_new_count int; v_next_release timestamptz;
BEGIN
  BEGIN v_lead_uuid := NEW.lead_id::uuid;
  EXCEPTION WHEN others THEN RETURN NEW; END;

  SELECT (team_id = v_team_blue) OR public.is_agent_on_team_blue(assigned_to)
    INTO v_is_blue
  FROM public.sales_leads WHERE id = v_lead_uuid;

  IF v_is_blue IS NOT TRUE THEN RETURN NEW; END IF;

  v_answered := COALESCE(NEW.outcome,'') IN ('spoken','contacted','sale','callback_booked');

  IF v_answered THEN
    UPDATE public.sales_leads
    SET orr_next_release_at = NULL, orr_locked_until = NULL,
        orr_first_call_deadline = NULL, orr_retry_deadline = NULL,
        orr_last_attempt_at = COALESCE(NEW.created_at, now()),
        orr_attempt_count = orr_attempt_count + 1
    WHERE id = v_lead_uuid;
    INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
    VALUES (v_lead_uuid, NEW.agent_id, 'open_round_robin', 'orr_customer_answered');
    RETURN NEW;
  END IF;

  UPDATE public.sales_leads
  SET orr_attempt_count = orr_attempt_count + 1,
      orr_last_attempt_at = COALESCE(NEW.created_at, now()),
      orr_first_call_deadline = NULL,
      orr_retry_deadline = NULL
  WHERE id = v_lead_uuid
  RETURNING orr_attempt_count INTO v_new_count;

  IF v_new_count IS NULL THEN RETURN NEW; END IF;

  -- No attempt cap: leads stay open until an agent closes them explicitly.
  v_next_release := public.orr_compute_next_release(v_new_count + 1, COALESCE(NEW.created_at, now()));

  UPDATE public.sales_leads
  SET orr_next_release_at = v_next_release, orr_locked_until = v_next_release
  WHERE id = v_lead_uuid;

  INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
  VALUES (v_lead_uuid, NEW.agent_id, 'open_round_robin',
          'orr_attempt_' || v_new_count || '_scheduled_next_' || (v_new_count + 1));
  RETURN NEW;
END; $function$;

-- 3. End-of-call handler: no auto-dormancy
CREATE OR REPLACE FUNCTION public.orr_call_ended(_call_log_id uuid, _outcome text, _notes text DEFAULT NULL::text, _callback_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    UPDATE public.sales_leads
    SET orr_attempt_count   = orr_attempt_count + 1,
        orr_last_attempt_at = now(),
        orr_first_call_deadline = NULL,
        orr_retry_deadline  = NULL
    WHERE id = v_lead
    RETURNING orr_attempt_count INTO v_new_count;

    -- No attempt cap: always schedule the next release.
    IF v_new_count IS NOT NULL THEN
      v_next_release := public.orr_compute_next_release(v_new_count + 1, now());
      UPDATE public.sales_leads
      SET orr_next_release_at = v_next_release,
          orr_locked_until    = v_next_release
      WHERE id = v_lead;
    END IF;
  END IF;

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
                              ELSE 'cooling_off' END,
      updated_at       = now()
  WHERE id = _call_log_id;

  IF NOT v_answered THEN
    UPDATE public.lead_customers
    SET lock_state    = 'cooling_off',
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
  VALUES (v_lead, v_log.agent_id, 'open_round_robin', 'orr_call_ended_' || _outcome);

  RETURN jsonb_build_object(
    'ok', true,
    'call_log_id', _call_log_id,
    'contact_made', v_answered,
    'marked_dormant', false,
    'next_eligible_at', v_next_release,
    'new_status', v_new_status
  );
END;
$function$;

-- 4. Missed callbacks: keep scheduling follow-ups, never auto-close
CREATE OR REPLACE FUNCTION public.orr_log_callback_no_answer(_lead_id uuid, _agent_id uuid, _follow_up_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         COALESCE(array_length(string_to_array(COALESCE(notes,''), '[ORR] Callback follow-up scheduled'), 1) - 1, 0)
    INTO v_owner, v_status, v_followups_used
  FROM public.sales_leads
  WHERE id = _lead_id;

  IF v_status IS DISTINCT FROM 'callback_booked' THEN
    RAISE EXCEPTION 'orr_log_callback_no_answer: lead is not in callback_booked status (current: %)', v_status;
  END IF;

  IF v_owner IS DISTINCT FROM _agent_id THEN
    RAISE EXCEPTION 'orr_log_callback_no_answer: only the owning agent may log the missed callback';
  END IF;

  -- Unlimited follow-ups. The lead only closes when the agent picks a closing outcome.
  v_new_followup := COALESCE(_follow_up_at, now() + interval '2 hours');
  IF v_new_followup < now() + interval '30 minutes' THEN
    RAISE EXCEPTION 'orr_log_callback_no_answer: follow_up_at must be at least 30 minutes in the future';
  END IF;

  UPDATE public.sales_leads
  SET callback_at = v_new_followup,
      status = 'callback_booked',
      assigned_to = _agent_id,
      orr_next_release_at = NULL,
      orr_locked_until = NULL,
      notes = COALESCE(notes,'') || E'\n[ORR] Callback follow-up scheduled '
              || to_char(v_new_followup AT TIME ZONE 'Europe/London','YYYY-MM-DD HH24:MI')
              || COALESCE(' — ' || NULLIF(_notes,''),'')
  WHERE id = _lead_id;

  INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
  VALUES (_lead_id, _agent_id, 'open_round_robin', 'orr_callback_no_answer_follow_up');

  RETURN jsonb_build_object(
    'ok', true,
    'action', 'follow_up_scheduled',
    'follow_up_at', v_new_followup,
    'follow_ups_used', v_followups_used + 1
  );
END;
$function$;