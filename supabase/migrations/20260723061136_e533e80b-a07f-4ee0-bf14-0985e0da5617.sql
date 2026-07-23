
-- 1) Roster reader
CREATE OR REPLACE FUNCTION public.orr_weekend_roster(_d date)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dow int := EXTRACT(dow FROM _d)::int;  -- 0=Sun, 6=Sat
  v_key text;
  v_raw jsonb;
  v_ids uuid[];
BEGIN
  IF v_dow = 6 THEN
    v_key := 'weekend_saturday_roster';
  ELSIF v_dow = 0 THEN
    v_key := 'weekend_sunday_roster';
  ELSE
    RETURN ARRAY[]::uuid[];
  END IF;

  SELECT setting_value INTO v_raw
  FROM public.lead_settings
  WHERE setting_key = v_key;

  IF v_raw IS NULL OR jsonb_typeof(v_raw) <> 'array' THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  SELECT COALESCE(array_agg(x::uuid), ARRAY[]::uuid[])
    INTO v_ids
  FROM jsonb_array_elements_text(v_raw) AS x
  WHERE x ~ '^[0-9a-fA-F-]{36}$';

  -- Only keep active sales agents
  SELECT COALESCE(array_agg(au.id), ARRAY[]::uuid[])
    INTO v_ids
  FROM public.admin_users au
  WHERE au.id = ANY(v_ids)
    AND au.is_active = true
    AND au.role IN ('sales','sales_lead','lead_gen');

  RETURN v_ids;
END; $$;

GRANT EXECUTE ON FUNCTION public.orr_weekend_roster(date) TO authenticated, service_role;

-- 2) Weekend-aware business-day check
CREATE OR REPLACE FUNCTION public.orr_is_business_day(_d date)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_weekend int[];
  v_dow     int := EXTRACT(dow FROM _d)::int;
  v_ids     uuid[];
BEGIN
  -- Bank holidays and exceptional closures ALWAYS force closed
  IF EXISTS (SELECT 1 FROM public.uk_bank_holidays WHERE holiday_date = _d) THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.orr_exceptional_closures WHERE closure_date = _d) THEN
    RETURN false;
  END IF;

  SELECT weekend_days INTO v_weekend FROM public.orr_config WHERE id = true;

  IF v_dow = ANY (v_weekend) THEN
    -- Open only if roster for that day has at least one active agent
    v_ids := public.orr_weekend_roster(_d);
    RETURN COALESCE(array_length(v_ids, 1), 0) >= 1;
  END IF;

  RETURN true;
END; $$;

-- 3) Weekend picker: round-robin among rostered agents, caps ignored
CREATE OR REPLACE FUNCTION public.orr_pick_weekend_agent(_d date)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids uuid[] := public.orr_weekend_roster(_d);
  v_pick uuid;
BEGIN
  IF v_ids IS NULL OR array_length(v_ids,1) IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fewest-today-first, then oldest last_assigned_at
  SELECT au.id INTO v_pick
  FROM public.admin_users au
  LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = au.id
  WHERE au.id = ANY(v_ids)
  ORDER BY COALESCE(adc.assigned_today, 0) ASC,
           adc.last_assigned_at ASC NULLS FIRST,
           au.id
  LIMIT 1;

  IF v_pick IS NOT NULL THEN
    UPDATE public.agent_distribution_caps
    SET assigned_today = COALESCE(assigned_today,0) + 1,
        last_assigned_at = now()
    WHERE admin_user_id = v_pick;
  END IF;
  RETURN v_pick;
END; $$;

GRANT EXECUTE ON FUNCTION public.orr_pick_weekend_agent(date) TO authenticated, service_role;

-- 4) Weekend-aware ORR sweeper
CREATE OR REPLACE FUNCTION public.sweep_open_round_robin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_blue uuid := '14f567b3-4ba3-4baa-acef-8d0de8e24b2d';
  v_lead RECORD; v_new_agent uuid;
  v_released int := 0; v_passed int := 0; v_assigned int := 0;
  v_enabled boolean; v_any_on_duty boolean;
  v_in_hours boolean;
  v_today_local date;
  v_dow int;
  v_is_weekend boolean;
  v_weekend_ids uuid[];
  v_cfg public.orr_config%ROWTYPE;
BEGIN
  SELECT open_round_robin_enabled INTO v_enabled
  FROM public.lead_distribution_settings WHERE team_id = v_team_blue;
  IF v_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  SELECT * INTO v_cfg FROM public.orr_config WHERE id = true;
  v_today_local := ((now() AT TIME ZONE v_cfg.timezone))::date;
  v_dow := EXTRACT(dow FROM v_today_local)::int;
  v_is_weekend := (v_dow = 0 OR v_dow = 6);
  v_in_hours := public.orr_is_business_now();

  IF v_is_weekend THEN
    v_weekend_ids := public.orr_weekend_roster(v_today_local);
    v_any_on_duty := COALESCE(array_length(v_weekend_ids,1), 0) >= 1;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.agent_distribution_caps adc
      JOIN public.admin_users au ON au.id = adc.admin_user_id
      JOIN public.lead_team_members ltm ON ltm.admin_user_id = adc.admin_user_id
      WHERE ltm.team_id = v_team_blue AND ltm.workstream_new_leads = true
        AND au.is_active = true AND au.role IN ('sales','sales_lead')
        AND (adc.paused IS NULL OR adc.paused = false)
        AND public.is_agent_on_duty(adc.admin_user_id)
    ) INTO v_any_on_duty;
  END IF;

  IF NOT v_any_on_duty OR NOT v_in_hours THEN
    RETURN jsonb_build_object(
      'enabled', true, 'released', 0, 'passed', 0, 'assigned_overnight', 0,
      'ran_at', now(), 'is_weekend', v_is_weekend,
      'note', CASE
        WHEN v_is_weekend AND NOT v_any_on_duty THEN 'weekend_no_roster'
        WHEN NOT v_in_hours THEN 'outside_business_hours'
        ELSE 'no_agents_on_duty'
      END
    );
  END IF;

  -- New unassigned leads
  FOR v_lead IN
    SELECT sl.id, sl.lead_source FROM public.sales_leads sl
    WHERE sl.assigned_to IS NULL
      AND sl.status NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND sl.orr_next_release_at IS NULL
      AND sl.orr_attempt_count = 0
      AND sl.created_at >= now() - interval '7 days'
      AND EXISTS (
        SELECT 1 FROM public.lead_team_source_rules r
        WHERE r.team_id = v_team_blue AND r.allowed = true
          AND r.source = COALESCE(sl.lead_source::text,'unknown')
      )
    ORDER BY sl.created_at ASC LIMIT 50
  LOOP
    v_new_agent := CASE WHEN v_is_weekend
      THEN public.orr_pick_weekend_agent(v_today_local)
      ELSE public.pick_agent_for_distribution(v_team_blue, COALESCE(v_lead.lead_source::text,'unknown'))
    END;
    IF v_new_agent IS NOT NULL THEN
      UPDATE public.sales_leads
      SET assigned_to = v_new_agent, assigned_at = now(),
          orr_first_call_deadline = now() + interval '2 minutes'
      WHERE id = v_lead.id;
      INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
      VALUES (v_lead.id, v_new_agent, 'open_round_robin',
              CASE WHEN v_is_weekend THEN 'orr_weekend_assign' ELSE 'orr_release_attempt_1' END);
      v_assigned := v_assigned + 1;
    END IF;
  END LOOP;

  -- Scheduled re-releases (attempts 2+)
  FOR v_lead IN
    SELECT sl.id, sl.lead_source, sl.orr_attempt_count FROM public.sales_leads sl
    WHERE sl.orr_next_release_at IS NOT NULL
      AND sl.orr_next_release_at <= now()
      AND (sl.orr_locked_until IS NULL OR sl.orr_locked_until <= now())
      AND sl.status NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND sl.team_id = v_team_blue
    ORDER BY sl.orr_next_release_at ASC LIMIT 200
  LOOP
    v_new_agent := CASE WHEN v_is_weekend
      THEN public.orr_pick_weekend_agent(v_today_local)
      ELSE public.pick_agent_for_distribution(v_team_blue, COALESCE(v_lead.lead_source::text,'unknown'))
    END;
    IF v_new_agent IS NOT NULL THEN
      UPDATE public.sales_leads
      SET assigned_to = v_new_agent, assigned_at = now(),
          orr_first_call_deadline = now() + interval '2 minutes',
          orr_next_release_at = NULL, orr_locked_until = NULL
      WHERE id = v_lead.id;
      INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
      VALUES (v_lead.id, v_new_agent, 'open_round_robin',
              'orr_release_attempt_' || (v_lead.orr_attempt_count + 1));
      v_released := v_released + 1;
    END IF;
  END LOOP;

  -- Passed no-call: agent didn't dial within 2 min
  FOR v_lead IN
    SELECT sl.id, sl.assigned_to, sl.lead_source, sl.orr_first_call_deadline, sl.assigned_at
    FROM public.sales_leads sl
    WHERE sl.orr_first_call_deadline IS NOT NULL
      AND sl.orr_first_call_deadline < now()
      AND sl.assigned_to IS NOT NULL
      AND sl.status NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND public.is_agent_on_team_blue(sl.assigned_to)
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_call_logs lcl
        WHERE lcl.lead_id = sl.id::text
          AND lcl.created_at >= COALESCE(sl.assigned_at, now() - interval '1 day')
      )
    ORDER BY sl.orr_first_call_deadline ASC LIMIT 200
  LOOP
    v_new_agent := CASE WHEN v_is_weekend
      THEN public.orr_pick_weekend_agent(v_today_local)
      ELSE public.pick_agent_for_distribution(v_team_blue, COALESCE(v_lead.lead_source::text,'unknown'))
    END;
    IF v_new_agent IS NOT NULL AND v_new_agent <> v_lead.assigned_to THEN
      UPDATE public.sales_leads
      SET assigned_to = v_new_agent, assigned_at = now(),
          orr_first_call_deadline = now() + interval '2 minutes',
          orr_reassign_count = COALESCE(orr_reassign_count,0) + 1
      WHERE id = v_lead.id;
      INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
      VALUES (v_lead.id, v_new_agent, 'open_round_robin', 'orr_passed_no_call');
      v_passed := v_passed + 1;
    ELSE
      UPDATE public.sales_leads
      SET orr_first_call_deadline = now() + interval '2 minutes'
      WHERE id = v_lead.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'enabled', true, 'released', v_released, 'passed', v_passed,
    'assigned_overnight', v_assigned, 'reclaimed', v_released + v_passed,
    'is_weekend', v_is_weekend, 'ran_at', now()
  );
END; $$;
