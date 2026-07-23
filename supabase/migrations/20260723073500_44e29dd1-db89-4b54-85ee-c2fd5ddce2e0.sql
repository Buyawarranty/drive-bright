
-- 1) Patch pick_agent_for_distribution to skip ORR-mode agents.
-- ORR agents pull leads via open_pool_get_next; they must never be auto-pushed.
CREATE OR REPLACE FUNCTION public.pick_agent_for_distribution(p_team_id uuid, p_source text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings RECORD;
  v_next_agent RECORD;
  v_now timestamptz := now();
  v_today date := (v_now AT TIME ZONE 'Europe/London')::date;
  v_rr_id uuid;
  v_any_on_duty boolean;
  v_overflow_recipient RECORD;
  v_last_overflow_id uuid;
  v_last_overflow_sort int;
  v_overflow_rr_id uuid;
  v_min_priority int;
BEGIN
  -- Self-heal counters
  UPDATE public.agent_distribution_caps adc
  SET assigned_today = COALESCE((
        SELECT COUNT(*) FROM public.sales_leads sl
        WHERE sl.assigned_to = adc.admin_user_id
          AND sl.assigned_at >= (v_today::timestamp AT TIME ZONE 'Europe/London')
      ), 0),
      cap_reset_date = v_today
  WHERE adc.cap_reset_date IS DISTINCT FROM v_today
     OR adc.assigned_today > COALESCE((
        SELECT COUNT(*) FROM public.sales_leads sl
        WHERE sl.assigned_to = adc.admin_user_id
          AND sl.assigned_at >= (v_today::timestamp AT TIME ZONE 'Europe/London')
      ), 0);

  IF p_team_id IS NOT NULL THEN
    SELECT * INTO v_settings FROM public.lead_distribution_settings WHERE team_id = p_team_id LIMIT 1;
    IF v_settings IS NULL THEN
      SELECT * INTO v_settings FROM public.lead_distribution_settings WHERE team_id IS NULL LIMIT 1;
    END IF;
  ELSE
    SELECT * INTO v_settings FROM public.lead_distribution_settings WHERE team_id IS NULL LIMIT 1;
  END IF;

  -- Solo mode: only if solo agent is NOT in ORR mode.
  IF v_settings.solo_mode_enabled AND v_settings.solo_agent_id IS NOT NULL THEN
    IF (p_team_id IS NULL AND public.agent_works_new_leads(v_settings.solo_agent_id))
       OR EXISTS (
         SELECT 1 FROM public.lead_team_members ltm
         WHERE ltm.team_id = p_team_id
           AND ltm.admin_user_id = v_settings.solo_agent_id
           AND ltm.workstream_new_leads = true
       )
    THEN
      SELECT adc.* INTO v_next_agent
      FROM public.agent_distribution_caps adc
      JOIN public.admin_users au ON au.id = adc.admin_user_id
      WHERE adc.admin_user_id = v_settings.solo_agent_id
        AND au.is_active = true
        AND au.role IN ('sales','sales_lead')
        AND (adc.paused IS NULL OR adc.paused = false)
        AND COALESCE(adc.assignment_mode, 'round_robin') <> 'open_pool'
        AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
        AND public.is_agent_on_duty(adc.admin_user_id)
        AND (
          p_source IS NULL
          OR adc.allowed_sources IS NULL
          OR array_length(adc.allowed_sources, 1) IS NULL
          OR p_source = ANY (adc.allowed_sources)
        )
      LIMIT 1;

      IF v_next_agent.admin_user_id IS NOT NULL THEN
        UPDATE public.agent_distribution_caps
        SET assigned_today = COALESCE(assigned_today,0)+1, last_assigned_at = v_now
        WHERE admin_user_id = v_settings.solo_agent_id;
        RETURN v_settings.solo_agent_id;
      END IF;
    END IF;
  END IF;

  SELECT MIN(COALESCE(adc.priority, 999)) INTO v_min_priority
  FROM public.agent_distribution_caps adc
  JOIN public.admin_users au ON au.id = adc.admin_user_id
  WHERE au.is_active = true
    AND (adc.paused IS NULL OR adc.paused = false)
    AND au.role IN ('sales','sales_lead')
    AND COALESCE(adc.assignment_mode, 'round_robin') <> 'open_pool'
    AND public.is_agent_on_duty(adc.admin_user_id)
    AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
    AND (
      p_source IS NULL
      OR adc.allowed_sources IS NULL
      OR array_length(adc.allowed_sources, 1) IS NULL
      OR p_source = ANY (adc.allowed_sources)
    )
    AND (
      p_team_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.lead_team_members ltm
        WHERE ltm.team_id = p_team_id
          AND ltm.admin_user_id = adc.admin_user_id
          AND ltm.workstream_new_leads = true
      )
    )
    AND (p_team_id IS NOT NULL OR public.agent_works_new_leads(adc.admin_user_id));

  v_any_on_duty := v_min_priority IS NOT NULL;

  IF v_any_on_duty THEN
    SELECT adc.* INTO v_next_agent
    FROM public.agent_distribution_caps adc
    JOIN public.admin_users au ON au.id = adc.admin_user_id
    WHERE au.is_active = true
      AND (adc.paused IS NULL OR adc.paused = false)
      AND au.role IN ('sales','sales_lead')
      AND COALESCE(adc.assignment_mode, 'round_robin') <> 'open_pool'
      AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
      AND public.is_agent_on_duty(adc.admin_user_id)
      AND COALESCE(adc.priority, 999) = v_min_priority
      AND (
        p_source IS NULL
        OR adc.allowed_sources IS NULL
        OR array_length(adc.allowed_sources, 1) IS NULL
        OR p_source = ANY (adc.allowed_sources)
      )
      AND (
        p_team_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.lead_team_members ltm
          WHERE ltm.team_id = p_team_id
            AND ltm.admin_user_id = adc.admin_user_id
            AND ltm.workstream_new_leads = true
        )
      )
      AND (p_team_id IS NOT NULL OR public.agent_works_new_leads(adc.admin_user_id))
    ORDER BY
      COALESCE(adc.assigned_today, 0) ASC,
      adc.last_assigned_at ASC NULLS FIRST,
      adc.sort_order ASC
    LIMIT 1;

    IF v_next_agent.admin_user_id IS NOT NULL THEN
      UPDATE public.agent_distribution_caps
      SET assigned_today = COALESCE(assigned_today,0)+1, last_assigned_at = v_now
      WHERE admin_user_id = v_next_agent.admin_user_id;

      IF p_team_id IS NULL THEN
        SELECT id INTO v_rr_id FROM public.round_robin_state WHERE team_id IS NULL LIMIT 1 FOR UPDATE;
      ELSE
        SELECT id INTO v_rr_id FROM public.round_robin_state WHERE team_id = p_team_id LIMIT 1 FOR UPDATE;
      END IF;

      IF v_rr_id IS NOT NULL THEN
        UPDATE public.round_robin_state
        SET last_assigned_user_id = v_next_agent.admin_user_id, updated_at = v_now
        WHERE id = v_rr_id;
      ELSE
        INSERT INTO public.round_robin_state (last_assigned_user_id, updated_at, team_id)
        VALUES (v_next_agent.admin_user_id, v_now, p_team_id);
      END IF;

      RETURN v_next_agent.admin_user_id;
    END IF;
  END IF;

  -- Overflow fallback also skips ORR agents.
  SELECT id, last_assigned_overflow_id INTO v_overflow_rr_id, v_last_overflow_id
  FROM public.overflow_round_robin_state WHERE team_id IS NULL LIMIT 1 FOR UPDATE;

  SELECT o.sort_order INTO v_last_overflow_sort
  FROM public.overflow_recipients o WHERE o.id = v_last_overflow_id;

  SELECT o.* INTO v_overflow_recipient
  FROM public.overflow_recipients o
  JOIN public.admin_users au ON au.id = o.admin_user_id
  LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = o.admin_user_id
  WHERE o.is_active = true
    AND au.is_active = true
    AND au.role IN ('sales','sales_lead')
    AND COALESCE(adc.paused, false) = false
    AND COALESCE(adc.assignment_mode, 'round_robin') <> 'open_pool'
    AND public.agent_works_new_leads(o.admin_user_id)
    AND (v_last_overflow_sort IS NULL OR o.sort_order > v_last_overflow_sort)
  ORDER BY o.sort_order ASC, o.id ASC
  LIMIT 1;

  IF v_overflow_recipient.admin_user_id IS NULL THEN
    SELECT o.* INTO v_overflow_recipient
    FROM public.overflow_recipients o
    JOIN public.admin_users au ON au.id = o.admin_user_id
    LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = o.admin_user_id
    WHERE o.is_active = true
      AND au.is_active = true
      AND au.role IN ('sales','sales_lead')
      AND COALESCE(adc.paused, false) = false
      AND COALESCE(adc.assignment_mode, 'round_robin') <> 'open_pool'
      AND public.agent_works_new_leads(o.admin_user_id)
    ORDER BY o.sort_order ASC, o.id ASC
    LIMIT 1;
  END IF;

  IF v_overflow_recipient.admin_user_id IS NOT NULL THEN
    IF v_overflow_rr_id IS NOT NULL THEN
      UPDATE public.overflow_round_robin_state
      SET last_assigned_overflow_id = v_overflow_recipient.id, updated_at = v_now
      WHERE id = v_overflow_rr_id;
    ELSE
      INSERT INTO public.overflow_round_robin_state (last_assigned_overflow_id, updated_at, team_id)
      VALUES (v_overflow_recipient.id, v_now, NULL);
    END IF;

    UPDATE public.agent_distribution_caps
    SET assigned_today = COALESCE(assigned_today,0)+1, last_assigned_at = v_now
    WHERE admin_user_id = v_overflow_recipient.admin_user_id;

    RETURN v_overflow_recipient.admin_user_id;
  END IF;

  RETURN NULL;
END;
$function$;

-- 2) Un-assign overnight ORR leads that were auto-pushed but never called.
-- They return to the shared pool and become claimable at their scheduled release.
UPDATE public.sales_leads sl
SET assigned_to = NULL,
    owner_agent = NULL,
    queue = 'live_open_pool',
    pool_status = 'new',
    locked_by = NULL,
    locked_at = NULL,
    orr_first_call_deadline = NULL,
    updated_at = now()
FROM public.agent_distribution_caps adc
WHERE sl.assigned_to = adc.admin_user_id
  AND adc.assignment_mode = 'open_pool'
  AND COALESCE(sl.call_count, 0) = 0
  AND sl.status = 'new'::lead_status
  AND (sl.intake_class = 'overnight' OR sl.orr_pool_kind = 'overnight');

-- 3) Overnight gate + ORR-only claim in open_pool_get_next.
-- Leads whose eligible_at / orr_pool_next_open_at is still in the future
-- cannot be claimed — they wait until their scheduled release (typically 09:00).
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
  -- Resume any lock this agent already holds (page refresh, tab switch).
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

  -- Owned retries (7-attempt ladder) come first.
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

  -- Shared pool pick — with overnight gate.
  WITH ranked_candidates AS MATERIALIZED (
    SELECT
      sl.id, sl.email, sl.vehicle_reg,
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
      sl.next_action_at, sl.created_at
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
      AND (sl.assigned_to IS NULL OR sl.assigned_to = _agent)
      AND (sl.locked_by IS NULL OR sl.locked_at < now() - interval '7 minutes')
      AND (sl.next_action_at IS NULL OR sl.next_action_at <= now())
      -- Never-contacted only for live_open_pool
      AND (
        sl.queue <> 'live_open_pool'
        OR (
          COALESCE(sl.call_count, 0) = 0
          AND sl.status = 'new'::lead_status
        )
      )
      -- Overnight gate: block until the scheduled release time passes.
      AND (sl.eligible_at IS NULL OR sl.eligible_at <= now())
      AND (sl.orr_pool_next_open_at IS NULL OR sl.orr_pool_next_open_at <= now())
    ORDER BY priority_band, sl.next_action_at NULLS LAST, sl.created_at DESC
    LIMIT 500
  ), eligible AS MATERIALIZED (
    SELECT rc.id, rc.priority_band, rc.next_action_at, rc.created_at
    FROM ranked_candidates rc
    WHERE NOT EXISTS (
      SELECT 1 FROM public.customers c
      WHERE COALESCE(c.is_deleted, false) = false
        AND lower(COALESCE(c.status, '')) NOT IN ('cancelled','refunded')
        AND (
          (COALESCE(rc.email,'') <> '' AND lower(c.email) = lower(rc.email))
          OR (COALESCE(rc.vehicle_reg,'') <> ''
              AND upper(regexp_replace(c.registration_plate, '\s+', '', 'g'))
                = upper(regexp_replace(rc.vehicle_reg, '\s+', '', 'g')))
        )
    )
  )
  SELECT id INTO _picked
    FROM eligible
   ORDER BY priority_band, next_action_at NULLS LAST, created_at DESC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF _picked IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.sales_leads
     SET pool_status    = 'calling_locked',
         locked_by      = _agent,
         locked_at      = now(),
         last_action_at = now()
   WHERE id = _picked;

  RETURN QUERY SELECT _picked;
END;
$function$;
