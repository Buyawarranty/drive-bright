-- 1. Source alias helper: map a stored lead_source to all equivalent stored spellings.
CREATE OR REPLACE FUNCTION public.lead_source_aliases(_source text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE lower(coalesce(_source, ''))
    WHEN 'website'   THEN ARRAY['website','organic','direct']
    WHEN 'organic'   THEN ARRAY['website','organic','direct']
    WHEN 'direct'    THEN ARRAY['website','organic','direct']
    WHEN 'social_ad' THEN ARRAY['social_ad','facebook','meta']
    WHEN 'facebook'  THEN ARRAY['social_ad','facebook','meta']
    WHEN 'meta'      THEN ARRAY['social_ad','facebook','meta']
    WHEN 'google_ad' THEN ARRAY['google_ad','google']
    WHEN 'google'    THEN ARRAY['google_ad','google']
    WHEN 'bing_ad'   THEN ARRAY['bing_ad','bing','microsoft']
    WHEN 'bing'      THEN ARRAY['bing_ad','bing','microsoft']
    WHEN 'tiktok_ad' THEN ARRAY['tiktok_ad','tiktok']
    WHEN 'tiktok'    THEN ARRAY['tiktok_ad','tiktok']
    ELSE ARRAY[lower(coalesce(_source, ''))]
  END
$$;

-- 2. Does this agent handle this lead source? Empty/NULL allowed_sources = every source.
CREATE OR REPLACE FUNCTION public.agent_accepts_lead_source(_agent uuid, _source text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _agent IS NULL THEN false
    WHEN _source IS NULL OR _source = '' THEN true
    ELSE COALESCE((
      SELECT adc.allowed_sources IS NULL
             OR array_length(adc.allowed_sources, 1) IS NULL
             OR EXISTS (
               SELECT 1 FROM unnest(adc.allowed_sources) AS s
               WHERE lower(s) = ANY (public.lead_source_aliases(_source))
             )
      FROM public.agent_distribution_caps adc
      WHERE adc.admin_user_id = _agent
      LIMIT 1
    ), true)
  END
$$;

GRANT EXECUTE ON FUNCTION public.lead_source_aliases(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_accepts_lead_source(uuid, text) TO authenticated, service_role;

-- 3. ORR offer: only offer a lead to agents who handle its source.
CREATE OR REPLACE FUNCTION public.orr_offer_lead_to_next(_lead uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_lead RECORD; v_agent uuid; v_now timestamptz:=now(); v_london timestamptz:=(now() AT TIME ZONE 'Europe/London'); v_hour int:=extract(hour from (now() AT TIME ZONE 'Europe/London'))::int;
BEGIN
  SELECT id,assigned_to,pool_status,orr_offer_passed_by,eligible_at,orr_pool_next_open_at,status,is_paid,lead_source::text AS src
    INTO v_lead FROM public.sales_leads WHERE id=_lead FOR UPDATE;
  IF v_lead.id IS NULL OR COALESCE(v_lead.is_paid,false) THEN RETURN NULL; END IF;
  IF (v_lead.eligible_at IS NOT NULL AND v_lead.eligible_at>v_now) OR (v_lead.orr_pool_next_open_at IS NOT NULL AND v_lead.orr_pool_next_open_at>v_now) OR v_hour<9 OR v_hour>=18 THEN RETURN NULL; END IF;
  SELECT adc.admin_user_id INTO v_agent FROM public.agent_distribution_caps adc JOIN public.admin_users au ON au.id=adc.admin_user_id
   WHERE au.is_active=true AND au.role IN ('sales','sales_lead') AND COALESCE(adc.paused,false)=false
     AND COALESCE(adc.assignment_mode,'round_robin')='open_pool' AND public.is_agent_on_duty(adc.admin_user_id)
     AND (adc.daily_cap IS NULL OR adc.assigned_today<adc.daily_cap)
     AND public.agent_accepts_lead_source(adc.admin_user_id, v_lead.src)
     AND NOT (adc.admin_user_id=ANY(COALESCE(v_lead.orr_offer_passed_by,'{}'::uuid[])))
   ORDER BY COALESCE(adc.assigned_today,0),adc.last_assigned_at NULLS FIRST,adc.sort_order LIMIT 1;
  IF v_agent IS NULL THEN
    UPDATE public.sales_leads SET assigned_to=NULL,pool_status='new',queue='live_open_pool',orr_first_call_deadline=NULL,orr_offer_expires_at=NULL,orr_offer_passed_by='{}'::uuid[],updated_at=v_now WHERE id=_lead;
    RETURN NULL;
  END IF;
  UPDATE public.sales_leads SET assigned_to=v_agent,pool_status='new',queue='live_open_pool',orr_first_call_deadline=v_now+interval '120 seconds',orr_offer_expires_at=v_now+interval '120 seconds',updated_at=v_now WHERE id=_lead;
  UPDATE public.agent_distribution_caps SET last_assigned_at=v_now WHERE admin_user_id=v_agent;
  RETURN v_agent;
END;
$function$;

-- 4. Per-agent top of the retry queue.
DROP FUNCTION IF EXISTS public.orr_next_retry_lead();

CREATE OR REPLACE FUNCTION public.orr_next_retry_lead(_agent uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    AND (_agent IS NULL OR public.agent_accepts_lead_source(_agent, sl.lead_source::text))
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
END; $function$;

GRANT EXECUTE ON FUNCTION public.orr_next_retry_lead(uuid) TO authenticated, service_role;

-- 5. Pool claim: judge "top of queue" from the claiming agent's own allowed sources.
CREATE OR REPLACE FUNCTION public.orr_claim_pool_lead(_lead_id uuid, _agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead RECORD; v_lock jsonb; v_deadline timestamptz;
  v_avail uuid[]; v_top uuid;
BEGIN
  v_top := public.orr_next_retry_lead(_agent_id);
  IF v_top IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'queue_empty_or_closed');
  END IF;
  IF v_top <> _lead_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_top_of_queue', 'next_lead_id', v_top);
  END IF;

  SELECT id, assigned_to, phone_normalized, status, orr_attempt_count, orr_pool_state, lead_source::text AS src
  INTO v_lead FROM public.sales_leads WHERE id = _lead_id FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'lead_not_found'); END IF;
  IF v_lead.assigned_to IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_assigned');
  END IF;
  IF NOT public.agent_accepts_lead_source(_agent_id, v_lead.src) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'source_not_allowed');
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
END; $function$;

-- 6. First attempt / retry assignment: refuse a source the agent does not handle.
CREATE OR REPLACE FUNCTION public.orr_assign_attempt_one(_lead_id uuid, _agent_id uuid, _kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  SELECT id, assigned_to, phone_normalized, status, lead_source::text AS src,
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
  IF NOT public.agent_accepts_lead_source(_agent_id, v_lead.src) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'source_not_allowed');
  END IF;

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
END; $function$;

CREATE OR REPLACE FUNCTION public.orr_assign_retry(_lead_id uuid, _agent_id uuid, _queue text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead     RECORD;
  v_lock     jsonb;
  v_deadline timestamptz;
BEGIN
  SELECT id, assigned_to, phone_normalized, status, orr_attempt_count, lead_source::text AS src
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
  IF NOT public.agent_accepts_lead_source(_agent_id, v_lead.src) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'source_not_allowed');
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
END; $function$;

-- 7. "Next thing to work" skips sources the agent does not handle.
CREATE OR REPLACE FUNCTION public.orr_agent_next_work(_agent_id uuid)
RETURNS TABLE(tier integer, kind text, lead_id uuid, due_at timestamp with time zone)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orr_team uuid := public.orr_enabled_team();
BEGIN
  IF v_orr_team IS NULL OR NOT public.is_agent_on_orr_team(_agent_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 1, 'new_live_lead', sl.id, sl.eligible_at
  FROM public.sales_leads sl
  WHERE sl.team_id = v_orr_team
    AND sl.intake_class = 'live'
    AND sl.assigned_to IS NULL
    AND COALESCE(sl.orr_attempt_count, 0) = 0
    AND COALESCE(sl.orr_dormant_at, 'epoch'::timestamptz) = 'epoch'::timestamptz
    AND public.agent_accepts_lead_source(_agent_id, sl.lead_source::text)
  ORDER BY sl.created_at ASC
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT 2, 'agreed_callback', NULLIF(r.lead_id,'')::uuid, COALESCE(r.snoozed_until, r.reminder_time)
  FROM public.lead_reminders r
  WHERE r.user_id = _agent_id::text
    AND r.status = 'pending'
    AND lower(COALESCE(r.label,'')) LIKE '%callback%'
    AND COALESCE(r.snoozed_until, r.reminder_time) <= now() + interval '15 minutes'
  ORDER BY COALESCE(r.snoozed_until, r.reminder_time) ASC
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT 3, 'active_sale', sl.id, sl.orr_last_attempt_at
  FROM public.sales_leads sl
  WHERE sl.assigned_to = _agent_id
    AND sl.team_id = v_orr_team
    AND COALESCE(sl.status::text, '') NOT IN ('converted','lost','fake_lead','dormant')
    AND EXISTS (SELECT 1 FROM public.lead_call_logs c WHERE c.lead_id = sl.id::text)
  ORDER BY sl.orr_last_attempt_at DESC NULLS LAST
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT 4, 'overnight_attempt_1', sl.id, sl.eligible_at
  FROM public.sales_leads sl
  WHERE sl.team_id = v_orr_team
    AND sl.intake_class = 'overnight'
    AND sl.assigned_to IS NULL
    AND COALESCE(sl.orr_attempt_count, 0) = 0
    AND sl.eligible_at IS NOT NULL AND sl.eligible_at <= now()
    AND public.agent_accepts_lead_source(_agent_id, sl.lead_source::text)
  ORDER BY sl.eligible_at ASC
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT 5, 'orr_due_retry', sl.id, sl.orr_next_release_at
  FROM public.sales_leads sl
  WHERE sl.team_id = v_orr_team
    AND sl.assigned_to IS NULL
    AND COALESCE(sl.orr_attempt_count, 0) >= 1
    AND sl.orr_next_release_at IS NOT NULL
    AND sl.orr_next_release_at <= now()
    AND sl.orr_dormant_at IS NULL
    AND public.agent_accepts_lead_source(_agent_id, sl.lead_source::text)
  ORDER BY sl.orr_next_release_at ASC
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT 6, 'admin_followup', NULL::uuid, NULL::timestamptz;
END;
$function$;