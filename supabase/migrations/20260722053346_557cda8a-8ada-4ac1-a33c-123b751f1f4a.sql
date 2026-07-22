
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS orr_attempt_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orr_next_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS orr_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS orr_locked_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_sales_leads_orr_next_release
  ON public.sales_leads (orr_next_release_at)
  WHERE orr_next_release_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.uk_bank_holidays (
  holiday_date date PRIMARY KEY,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.uk_bank_holidays TO authenticated;
GRANT ALL ON public.uk_bank_holidays TO service_role;
ALTER TABLE public.uk_bank_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_bank_holidays" ON public.uk_bank_holidays;
CREATE POLICY "auth_read_bank_holidays" ON public.uk_bank_holidays
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.uk_bank_holidays(holiday_date,name) VALUES
  ('2026-01-01','New Year''s Day'),
  ('2026-04-03','Good Friday'),
  ('2026-04-06','Easter Monday'),
  ('2026-05-04','Early May bank holiday'),
  ('2026-05-25','Spring bank holiday'),
  ('2026-08-31','Summer bank holiday'),
  ('2026-12-25','Christmas Day'),
  ('2026-12-28','Boxing Day (substitute)'),
  ('2027-01-01','New Year''s Day'),
  ('2027-03-26','Good Friday'),
  ('2027-03-29','Easter Monday'),
  ('2027-05-03','Early May bank holiday'),
  ('2027-05-31','Spring bank holiday'),
  ('2027-08-30','Summer bank holiday'),
  ('2027-12-27','Christmas Day (substitute)'),
  ('2027-12-28','Boxing Day (substitute)'),
  ('2028-01-03','New Year''s Day (substitute)'),
  ('2028-04-14','Good Friday'),
  ('2028-04-17','Easter Monday'),
  ('2028-05-01','Early May bank holiday'),
  ('2028-05-29','Spring bank holiday'),
  ('2028-08-28','Summer bank holiday'),
  ('2028-12-25','Christmas Day'),
  ('2028-12-26','Boxing Day')
ON CONFLICT (holiday_date) DO NOTHING;

CREATE OR REPLACE FUNCTION public.orr_add_business_days(_from_date date, _n int)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d date := _from_date; remaining int := _n;
BEGIN
  WHILE remaining > 0 LOOP
    d := d + 1;
    IF EXTRACT(DOW FROM d) NOT IN (0,6)
       AND NOT EXISTS (SELECT 1 FROM public.uk_bank_holidays WHERE holiday_date = d) THEN
      remaining := remaining - 1;
    END IF;
  END LOOP;
  RETURN d;
END; $$;

CREATE OR REPLACE FUNCTION public.orr_compute_next_release(_next_attempt_number int, _last_attempt_at timestamptz)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ldn_last timestamp; ldn_date date; target_date date; target_ldn timestamp;
BEGIN
  ldn_last := (_last_attempt_at AT TIME ZONE 'Europe/London');
  ldn_date := ldn_last::date;

  IF _next_attempt_number = 2 THEN
    RETURN _last_attempt_at + interval '10 minutes';
  ELSIF _next_attempt_number = 3 THEN
    IF ldn_last::time <= time '15:30' THEN
      target_ldn := ldn_date + time '17:30';
    ELSE
      target_date := public.orr_add_business_days(ldn_date, 1);
      target_ldn := target_date + time '10:00';
    END IF;
  ELSIF _next_attempt_number = 4 THEN
    target_date := public.orr_add_business_days(ldn_date, 1);
    target_ldn := target_date + time '10:00';
  ELSIF _next_attempt_number = 5 THEN
    target_date := public.orr_add_business_days(ldn_date, 2);
    target_ldn := target_date + time '13:00';
  ELSIF _next_attempt_number = 6 THEN
    target_date := public.orr_add_business_days(ldn_date, 2);
    target_ldn := target_date + time '17:30';
  ELSIF _next_attempt_number = 7 THEN
    target_date := public.orr_add_business_days(ldn_date, 3);
    target_ldn := target_date + time '10:00';
  ELSE
    RETURN NULL;
  END IF;
  RETURN target_ldn AT TIME ZONE 'Europe/London';
END; $$;

CREATE OR REPLACE FUNCTION public.orr_on_call_logged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  IF v_new_count >= 7 THEN
    UPDATE public.sales_leads
    SET status = 'dormant', orr_dormant_at = now(),
        orr_next_release_at = NULL, orr_locked_until = NULL, assigned_to = NULL,
        notes = COALESCE(notes,'') || E'\n[ORR] Dormant — no contact after 7 attempts.'
    WHERE id = v_lead_uuid;
    INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
    VALUES (v_lead_uuid, NULL, 'open_round_robin', 'orr_dormant_no_contact');
    RETURN NEW;
  END IF;

  v_next_release := public.orr_compute_next_release(v_new_count + 1, COALESCE(NEW.created_at, now()));

  UPDATE public.sales_leads
  SET orr_next_release_at = v_next_release, orr_locked_until = v_next_release
  WHERE id = v_lead_uuid;

  INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
  VALUES (v_lead_uuid, NEW.agent_id, 'open_round_robin',
          'orr_attempt_' || v_new_count || '_scheduled_next_' || (v_new_count + 1));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_orr_on_call_logged ON public.lead_call_logs;
CREATE TRIGGER trg_orr_on_call_logged
AFTER INSERT ON public.lead_call_logs
FOR EACH ROW EXECUTE FUNCTION public.orr_on_call_logged();

CREATE OR REPLACE FUNCTION public.orr_cancel_on_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status::text IN ('converted','sale','contacted','callback_booked')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.orr_next_release_at := NULL;
    NEW.orr_locked_until    := NULL;
    NEW.orr_first_call_deadline := NULL;
    NEW.orr_retry_deadline  := NULL;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_orr_cancel_on_close ON public.sales_leads;
CREATE TRIGGER trg_orr_cancel_on_close
BEFORE UPDATE OF status ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.orr_cancel_on_close();

CREATE OR REPLACE FUNCTION public.sweep_open_round_robin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_blue uuid := '14f567b3-4ba3-4baa-acef-8d0de8e24b2d';
  v_lead RECORD; v_new_agent uuid;
  v_released int := 0; v_passed int := 0; v_assigned int := 0;
  v_enabled boolean; v_any_on_duty boolean;
BEGIN
  SELECT open_round_robin_enabled INTO v_enabled
  FROM public.lead_distribution_settings WHERE team_id = v_team_blue;

  IF v_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.agent_distribution_caps adc
    JOIN public.admin_users au ON au.id = adc.admin_user_id
    JOIN public.lead_team_members ltm ON ltm.admin_user_id = adc.admin_user_id
    WHERE ltm.team_id = v_team_blue AND ltm.workstream_new_leads = true
      AND au.is_active = true AND au.role IN ('sales','sales_lead')
      AND (adc.paused IS NULL OR adc.paused = false)
      AND public.is_agent_on_duty(adc.admin_user_id)
  ) INTO v_any_on_duty;

  IF NOT v_any_on_duty THEN
    RETURN jsonb_build_object('enabled', true, 'released', 0, 'passed', 0, 'assigned_overnight', 0, 'ran_at', now(), 'note', 'no_agents_on_duty');
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
