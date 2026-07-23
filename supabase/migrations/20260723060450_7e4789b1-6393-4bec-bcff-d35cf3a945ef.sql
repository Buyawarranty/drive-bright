
-- 1) Business-hours "now" helper
CREATE OR REPLACE FUNCTION public.orr_is_business_now()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg   public.orr_config%ROWTYPE;
  v_local timestamp;
BEGIN
  SELECT * INTO v_cfg FROM public.orr_config WHERE id = true;
  v_local := (now() AT TIME ZONE v_cfg.timezone);
  RETURN public.orr_is_business_day(v_local::date)
     AND v_local::time >= v_cfg.work_start
     AND v_local::time <  v_cfg.work_end;
END; $$;

GRANT EXECUTE ON FUNCTION public.orr_is_business_now() TO authenticated, service_role;

-- 2) Snap every computed next-release forward to business hours
CREATE OR REPLACE FUNCTION public.orr_compute_next_release(_next_attempt_number int, _last_attempt_at timestamptz)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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

  IF _next_attempt_number = 2 THEN
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
  ELSIF _next_attempt_number = 7 THEN
    target_date := public.orr_add_business_days(ldn_date, 3);
    v_candidate := (target_date + time '10:00') AT TIME ZONE v_cfg.timezone;
  ELSE
    RETURN NULL;
  END IF;

  -- Snap forward if candidate is outside working hours / non-business day
  v_local := (v_candidate AT TIME ZONE v_cfg.timezone);
  IF NOT public.orr_is_business_day(v_local::date)
     OR v_local::time < v_cfg.work_start
     OR v_local::time >= v_cfg.work_end THEN
    v_candidate := public.orr_next_business_open(v_candidate);
  END IF;
  RETURN v_candidate;
END; $$;

-- 3) Trigger: any 2-min first-call deadline set outside working hours defers to next open + 2 min
CREATE OR REPLACE FUNCTION public.orr_defer_first_call_deadline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg   public.orr_config%ROWTYPE;
  v_local timestamp;
  v_open  timestamptz;
BEGIN
  IF NEW.orr_first_call_deadline IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.orr_first_call_deadline IS NOT DISTINCT FROM NEW.orr_first_call_deadline THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_cfg FROM public.orr_config WHERE id = true;
  v_local := (NEW.orr_first_call_deadline AT TIME ZONE v_cfg.timezone);

  IF NOT public.orr_is_business_day(v_local::date)
     OR v_local::time < v_cfg.work_start
     OR v_local::time >= v_cfg.work_end THEN
    v_open := public.orr_next_business_open(NEW.orr_first_call_deadline);
    NEW.orr_first_call_deadline := v_open + interval '2 minutes';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_orr_defer_first_call_deadline ON public.sales_leads;
CREATE TRIGGER trg_orr_defer_first_call_deadline
BEFORE INSERT OR UPDATE OF orr_first_call_deadline ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.orr_defer_first_call_deadline();

-- 4) Sweep: gate the passed-no-call reassignment loop to working hours
CREATE OR REPLACE FUNCTION public.sweep_open_round_robin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_blue uuid := '14f567b3-4ba3-4baa-acef-8d0de8e24b2d';
  v_lead RECORD; v_new_agent uuid;
  v_released int := 0; v_passed int := 0; v_assigned int := 0;
  v_enabled boolean; v_any_on_duty boolean;
  v_in_hours boolean;
BEGIN
  SELECT open_round_robin_enabled INTO v_enabled
  FROM public.lead_distribution_settings WHERE team_id = v_team_blue;

  IF v_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  v_in_hours := public.orr_is_business_now();

  SELECT EXISTS(
    SELECT 1 FROM public.agent_distribution_caps adc
    JOIN public.admin_users au ON au.id = adc.admin_user_id
    JOIN public.lead_team_members ltm ON ltm.admin_user_id = adc.admin_user_id
    WHERE ltm.team_id = v_team_blue AND ltm.workstream_new_leads = true
      AND au.is_active = true AND au.role IN ('sales','sales_lead')
      AND (adc.paused IS NULL OR adc.paused = false)
      AND public.is_agent_on_duty(adc.admin_user_id)
  ) INTO v_any_on_duty;

  IF NOT v_any_on_duty OR NOT v_in_hours THEN
    RETURN jsonb_build_object(
      'enabled', true, 'released', 0, 'passed', 0, 'assigned_overnight', 0,
      'ran_at', now(),
      'note', CASE WHEN NOT v_in_hours THEN 'outside_business_hours' ELSE 'no_agents_on_duty' END
    );
  END IF;

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
    v_new_agent := public.pick_agent_for_distribution(v_team_blue, COALESCE(v_lead.lead_source::text,'unknown'));
    IF v_new_agent IS NOT NULL THEN
      UPDATE public.sales_leads
      SET assigned_to = v_new_agent, assigned_at = now(),
          orr_first_call_deadline = now() + interval '2 minutes'
      WHERE id = v_lead.id;
      INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
      VALUES (v_lead.id, v_new_agent, 'open_round_robin', 'orr_release_attempt_1');
      v_assigned := v_assigned + 1;
    END IF;
  END LOOP;

  FOR v_lead IN
    SELECT sl.id, sl.lead_source, sl.orr_attempt_count FROM public.sales_leads sl
    WHERE sl.orr_next_release_at IS NOT NULL
      AND sl.orr_next_release_at <= now()
      AND (sl.orr_locked_until IS NULL OR sl.orr_locked_until <= now())
      AND sl.status NOT IN ('converted','lost','fake_lead','dormant','archived')
      AND sl.team_id = v_team_blue
    ORDER BY sl.orr_next_release_at ASC LIMIT 200
  LOOP
    v_new_agent := public.pick_agent_for_distribution(v_team_blue, COALESCE(v_lead.lead_source::text,'unknown'));
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
    v_new_agent := public.pick_agent_for_distribution(v_team_blue, COALESCE(v_lead.lead_source::text,'unknown'));
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
    'dormant', 0, 'ran_at', now()
  );
END; $$;
