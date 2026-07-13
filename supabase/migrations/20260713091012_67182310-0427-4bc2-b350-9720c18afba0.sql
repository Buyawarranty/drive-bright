
-- 1) open_pool_log_outcome: also set assigned_to on soft-reserve so the lead
--    appears in the agent's My Leads list during the retry window.
CREATE OR REPLACE FUNCTION public.open_pool_log_outcome(
  _lead_id uuid,
  _agent uuid,
  _outcome text,
  _reason text DEFAULT NULL::text,
  _next_action_at timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _new_status  text;
  _new_queue   text;
  _new_owner   uuid;
  _keep_lock   boolean := false;
  _tags        text[]  := ARRAY[]::text[];
  _inc_calls   integer := 0;
  _current_calls integer;
  _attempt_num integer;
  _no_answer_tag text;
  _lost_tag    text;
  _retry_at    timestamptz;
  _final_action text;
  _locked_by   uuid;
  _owner_agent uuid;
  _caller_admin_id uuid;
  _caller_role text;
  _is_mgmt boolean := false;
  _retry_minutes integer;
  _soft_reserve boolean := false;
  _agent_admin_id uuid;
BEGIN
  SELECT locked_by, owner_agent
    INTO _locked_by, _owner_agent
  FROM sales_leads WHERE id = _lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  SELECT id, role INTO _caller_admin_id, _caller_role
    FROM admin_users WHERE user_id = auth.uid() AND is_active = true
    LIMIT 1;

  _is_mgmt := _caller_role IN ('admin','super_admin','sales_manager');

  IF NOT (
       _locked_by = _agent
    OR _owner_agent = _agent
    OR _owner_agent = _caller_admin_id
    OR (_locked_by IS NULL AND _owner_agent IS NULL)
    OR _is_mgmt
  ) THEN
    RAISE EXCEPTION 'Lead is not locked to this agent';
  END IF;

  SELECT id INTO _agent_admin_id
    FROM admin_users WHERE user_id = _agent AND is_active = true
    LIMIT 1;
  IF _agent_admin_id IS NULL THEN
    _agent_admin_id := _caller_admin_id;
  END IF;

  IF _outcome = 'callback_requested' AND _next_action_at IS NULL THEN
    RAISE EXCEPTION 'Callback date/time is required';
  END IF;
  IF _outcome IN ('not_interested','wrong_number') AND (_reason IS NULL OR btrim(_reason) = '') THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  SELECT COALESCE(call_count, 0) INTO _current_calls FROM sales_leads WHERE id = _lead_id;

  SELECT COALESCE(retry_minutes, 15) INTO _retry_minutes
    FROM shark_tank_settings WHERE id = 1;
  _retry_minutes := COALESCE(_retry_minutes, 15);

  CASE _outcome
    WHEN 'spoke_to_customer' THEN
      _new_status := 'contacted';         _new_queue := 'owned_by_agent'; _new_owner := _agent; _keep_lock := true;
    WHEN 'no_answer' THEN
      _inc_calls := 1;
      _attempt_num := _current_calls + 1;
      _no_answer_tag := 'no_answer_' || LEAST(_attempt_num, 3)::text;
      _tags := ARRAY[_no_answer_tag];
      IF _attempt_num >= 7 THEN
        SELECT no_answer_final_action INTO _final_action FROM shark_tank_settings WHERE id = 1;
        _final_action := COALESCE(_final_action, 'lost');
        _new_queue := 'nurture_queue'; _new_owner := NULL;
        IF _final_action = 'lost' THEN
          _new_status := 'lost';
          _tags := _tags || ARRAY['lost_could_not_contact'];
        ELSE
          _new_status := 'new';
        END IF;
        _retry_at := NULL;
      ELSE
        _new_status := 'new'; _new_queue := 'retry_queue';
        IF _attempt_num = 1 THEN
          _retry_at := now() + make_interval(mins => _retry_minutes);
          _new_owner := _agent;
          _soft_reserve := true;
        ELSE
          _new_owner := NULL;
          _retry_at := CASE _attempt_num
            WHEN 2 THEN now() + interval '2 hours'
            WHEN 3 THEN now() + interval '4 hours'
            WHEN 4 THEN public.open_pool_next_working_day_9am()
            WHEN 5 THEN now() + interval '3 days'
            WHEN 6 THEN now() + interval '7 days'
          END;
        END IF;
      END IF;
    WHEN 'voicemail_left' THEN
      _new_status := 'new'; _new_queue := 'retry_queue'; _new_owner := NULL;
      _inc_calls := 1; _tags := ARRAY['voicemail_left'];
      _retry_at := now() + interval '2 hours';
    WHEN 'callback_requested' THEN
      _new_status := 'callback_booked';   _new_queue := 'callback_queue'; _new_owner := _agent; _keep_lock := true;
    WHEN 'quote_sent' THEN
      _new_status := 'quote_sent';        _new_queue := 'owned_by_agent'; _new_owner := _agent; _keep_lock := true;
      _tags := ARRAY['quote_sent'];
    WHEN 'policy_sent' THEN
      _new_status := 'policy_sent';       _new_queue := 'owned_by_agent'; _new_owner := _agent; _keep_lock := true;
      _tags := ARRAY['policy_booklet_sent'];
    WHEN 'payment_link_sent' THEN
      _new_status := 'payment_link_sent'; _new_queue := 'owned_by_agent'; _new_owner := _agent; _keep_lock := true;
      _tags := ARRAY['payment_link_sent','high_priority'];
    WHEN 'sold' THEN
      _new_status := 'converted';         _new_queue := 'closed';         _new_owner := _agent; _keep_lock := true;
    WHEN 'wrong_number' THEN
      _new_status := 'invalid';           _new_queue := 'closed';         _new_owner := NULL;
      _tags := ARRAY['invalid_details'];
    WHEN 'not_interested' THEN
      _new_status := 'lost';              _new_queue := 'closed';         _new_owner := NULL;
      _lost_tag := CASE _reason
        WHEN 'Price'                     THEN 'lost_price'
        WHEN 'Competitor'                THEN 'lost_competitor'
        WHEN 'Trust / claims concern'    THEN 'lost_trust_concern'
        WHEN 'Claim limit concern'       THEN 'lost_claim_limit'
        WHEN 'Already has warranty'      THEN 'lost_already_covered'
        WHEN 'Vehicle not purchased'     THEN 'lost_vehicle_not_bought'
        WHEN 'No perceived need'         THEN 'lost_no_longer_interested'
        ELSE NULL
      END;
      IF _lost_tag IS NOT NULL THEN _tags := ARRAY[_lost_tag]; END IF;
    ELSE
      RAISE EXCEPTION 'Unknown call outcome: %', _outcome;
  END CASE;

  UPDATE sales_leads
     SET call_outcome   = _outcome,
         pool_status    = _new_status,
         queue          = _new_queue,
         reason         = CASE
                            WHEN _outcome = 'wrong_number' THEN COALESCE(_reason, 'Invalid details')
                            WHEN _reason IS NOT NULL THEN _reason
                            ELSE reason
                          END,
         lost_reason    = CASE
                            WHEN _outcome = 'not_interested' THEN _reason
                            WHEN _outcome = 'no_answer' AND _attempt_num >= 7 AND _new_status = 'lost'
                              THEN 'Could not contact after 7 attempts'
                            ELSE lost_reason
                          END,
         next_action_at = CASE
                            WHEN _outcome = 'callback_requested' THEN _next_action_at
                            WHEN _outcome IN ('no_answer','voicemail_left') THEN _retry_at
                            ELSE NULL
                          END,
         last_action_at = now(),
         call_count     = COALESCE(call_count, 0) + _inc_calls,
         auto_tags      = (
           SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(auto_tags, ARRAY[]::text[]) || _tags))
         ),
         payment_method = CASE WHEN _outcome = 'payment_link_sent' THEN 'link_sent' ELSE payment_method END,
         is_paid        = CASE WHEN _outcome = 'sold' THEN true ELSE is_paid END,
         payment_date   = CASE WHEN _outcome = 'sold' THEN now() ELSE payment_date END,
         locked_by      = CASE
                            WHEN _keep_lock THEN _agent
                            WHEN _soft_reserve THEN _agent
                            ELSE NULL
                          END,
         locked_at      = CASE
                            WHEN _keep_lock THEN COALESCE(locked_at, now())
                            WHEN _soft_reserve THEN now()
                            ELSE NULL
                          END,
         owner_agent    = CASE
                            WHEN _new_owner IS NULL AND NOT _keep_lock AND NOT _soft_reserve THEN NULL
                            ELSE COALESCE(_new_owner, owner_agent)
                          END,
         -- Show the lead in the agent's My Leads list for both hard ownership
         -- (Spoken to / Follow-up / Quote sent / etc.) AND soft-reserve (first
         -- No answer) so the agent can retry within the 15-minute window.
         assigned_to    = CASE
                            WHEN (_keep_lock OR _soft_reserve) AND _agent_admin_id IS NOT NULL
                              THEN _agent_admin_id
                            ELSE assigned_to
                          END,
         assigned_at    = CASE
                            WHEN (_keep_lock OR _soft_reserve) AND _agent_admin_id IS NOT NULL
                              THEN COALESCE(assigned_at, now())
                            ELSE assigned_at
                          END
   WHERE id = _lead_id;
END;
$function$;

-- 2) open_pool_get_next: before searching the general pool, hand the agent
--    back any of their own soft-reserved leads that are due for retry
--    (owner_agent = agent, retry_queue, next_action_at <= now). Re-lock as
--    calling_locked so the client's Reservation flow can pick it up cleanly.
CREATE OR REPLACE FUNCTION public.open_pool_get_next(_agent uuid)
RETURNS TABLE(lead_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _existing uuid;
  _due_retry uuid;
  _picked uuid;
BEGIN
  -- (a) Active hard lock already held by this agent — return immediately.
  SELECT id INTO _existing
    FROM public.sales_leads
   WHERE locked_by = _agent
     AND pool_status = 'calling_locked'
   ORDER BY locked_at DESC
   LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN QUERY SELECT _existing;
    RETURN;
  END IF;

  -- (b) Soft-reserved retry (first No answer) whose retry window is now due.
  --     Promote it back to calling_locked so the agent can retry the same lead.
  SELECT id INTO _due_retry
    FROM public.sales_leads
   WHERE owner_agent = _agent
     AND queue = 'retry_queue'
     AND (next_action_at IS NULL OR next_action_at <= now())
     AND COALESCE(is_paid, false) = false
     AND status NOT IN (
           'converted'::lead_status,
           'fake_lead'::lead_status,
           'lost'::lead_status
         )
   ORDER BY next_action_at NULLS FIRST, last_action_at DESC NULLS LAST
   LIMIT 1;

  IF _due_retry IS NOT NULL THEN
    UPDATE public.sales_leads
       SET pool_status    = 'calling_locked',
           locked_by      = _agent,
           locked_at      = now(),
           last_action_at = now()
     WHERE id = _due_retry;
    RETURN QUERY SELECT _due_retry;
    RETURN;
  END IF;

  -- (c) Otherwise, rank + pick from the general open pool.
  WITH ranked_candidates AS MATERIALIZED (
    SELECT
      sl.id,
      sl.email,
      sl.vehicle_reg,
      CASE
        WHEN 'paid_google'   = ANY(sl.auto_tags) THEN 1
        WHEN 'paid_facebook' = ANY(sl.auto_tags) THEN 2
        WHEN 'website_quote' = ANY(sl.auto_tags)
             AND 'high_priority' = ANY(sl.auto_tags)             THEN 3
        WHEN sl.queue = 'callback_queue'
             AND sl.next_action_at IS NOT NULL
             AND sl.next_action_at <= now()                       THEN 4
        WHEN 'warranty_expiring' = ANY(sl.auto_tags)              THEN 5
        WHEN 'premium_vehicle'   = ANY(sl.auto_tags)              THEN 6
        WHEN 'website_quote'     = ANY(sl.auto_tags)              THEN 7
        WHEN COALESCE(sl.call_count,0) = 0                        THEN 8
        WHEN sl.queue = 'nurture_queue'                           THEN 9
        ELSE 10
      END AS priority_band,
      sl.next_action_at,
      sl.created_at
    FROM public.sales_leads sl
    WHERE sl.queue IN (
            'live_open_pool','morning_call_queue','retry_queue',
            'callback_queue','nurture_queue'
          )
      AND (sl.pool_status IS NULL
           OR sl.pool_status IN ('new','callback_booked','contacted'))
      AND COALESCE(sl.is_paid, false) = false
      AND sl.status NOT IN (
            'converted'::lead_status,
            'fake_lead'::lead_status,
            'lost'::lead_status
          )
      AND (sl.owner_agent IS NULL OR sl.owner_agent = _agent)
      AND (sl.locked_by IS NULL OR sl.locked_at < now() - interval '7 minutes')
      AND (sl.next_action_at IS NULL OR sl.next_action_at <= now())
    ORDER BY priority_band, sl.next_action_at NULLS LAST, sl.created_at DESC
    LIMIT 500
  ), eligible AS MATERIALIZED (
    SELECT rc.id, rc.priority_band, rc.next_action_at, rc.created_at
    FROM ranked_candidates rc
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE COALESCE(c.is_deleted, false) = false
        AND lower(COALESCE(c.status, '')) NOT IN ('cancelled','refunded')
        AND (
          (
            COALESCE(rc.email,'') <> ''
            AND lower(trim(rc.email)) = lower(trim(COALESCE(c.email,'')))
          )
          OR
          (
            COALESCE(rc.vehicle_reg,'') <> ''
            AND upper(regexp_replace(rc.vehicle_reg,'\s+','','g'))
              = upper(regexp_replace(COALESCE(c.registration_plate,''),'\s+','','g'))
          )
        )
    )
    ORDER BY rc.priority_band, rc.next_action_at NULLS LAST, rc.created_at DESC
    LIMIT 1
  )
  UPDATE public.sales_leads sl
     SET pool_status    = 'calling_locked',
         locked_by      = _agent,
         locked_at      = now(),
         last_action_at = now()
    FROM eligible e
   WHERE sl.id = e.id
   RETURNING sl.id INTO _picked;

  RETURN QUERY SELECT _picked;
END;
$function$;
