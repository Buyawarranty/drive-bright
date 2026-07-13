-- Store the Sunday solo agent id (changeable via settings later)
INSERT INTO public.lead_settings (setting_key, setting_value)
VALUES ('weekend_solo_agent_id', to_jsonb('019299c4-4bb3-4cfc-b205-0d6cd4f64dd5'::text))
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- =====================================================================
-- auto_assign_lead_round_robin: prepend weekend routing
-- Sunday → force-assign to configured solo agent (bypass caps)
-- Saturday → force to Open Pool (self-serve only)
-- Weekdays → unchanged existing behaviour
-- =====================================================================
CREATE OR REPLACE FUNCTION public.auto_assign_lead_round_robin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_rule RECORD;
  v_assigned uuid;
  v_routing_enabled boolean := false;
  v_source text;
  v_cap_check jsonb;
  v_preassigned uuid;
  v_preassigned_paused boolean := false;
  v_preassigned_works_new boolean := true;
  v_preassigned_mode text := 'round_robin';
  v_flow_mode text := 'round_robin';
  v_alt_next text := 'rr';
  v_settings_id uuid;
  v_send_to_pool boolean := false;
  v_overflow_id uuid;
  v_overflow_hops int := 0;
  v_visited uuid[] := ARRAY[]::uuid[];
  v_target_team uuid;
  -- Weekend routing
  v_uk_dow int;
  v_solo_id uuid;
  v_solo_active boolean := false;
BEGIN
  IF NEW.status IN ('lost', 'fake_lead') THEN
    RETURN NEW;
  END IF;

  -- ================================================================
  -- Weekend routing (Europe/London). Fires before any RR logic.
  -- ================================================================
  v_uk_dow := EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/London'))::int;

  IF v_uk_dow = 0 THEN
    -- Sunday: solo mode
    BEGIN
      SELECT (setting_value #>> '{}')::uuid INTO v_solo_id
        FROM public.lead_settings
       WHERE setting_key = 'weekend_solo_agent_id'
       LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_solo_id := NULL; END;

    IF v_solo_id IS NOT NULL THEN
      SELECT is_active INTO v_solo_active
        FROM public.admin_users WHERE id = v_solo_id;
    END IF;

    IF COALESCE(v_solo_active, false) THEN
      NEW.assigned_to := v_solo_id;
      NEW.owner_agent := v_solo_id;
      NEW.assigned_at := now();
      NEW.queue := 'live_new';
      BEGIN
        INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, v_solo_id, NULL, 'weekend_sunday_solo', 'Sunday solo mode — assigned to configured solo agent');
      EXCEPTION WHEN OTHERS THEN NULL; END;
      RETURN NEW;
    END IF;

    -- Solo agent unavailable → park in pool + flag coverage down
    NEW.assigned_to := NULL;
    NEW.queue := 'live_open_pool';
    NEW.pool_status := 'new';
    NEW.auto_tags := (
      SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(NEW.auto_tags, ARRAY[]::text[]) || ARRAY['sunday_coverage_down']))
    );
    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (NEW.id, NULL, NULL, 'weekend_sunday_coverage_down', 'Sunday: solo agent unavailable → parked in Open Pool');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN NEW;
  END IF;

  IF v_uk_dow = 6 THEN
    -- Saturday: skeleton crew, everything to Open Pool
    NEW.assigned_to := NULL;
    NEW.queue := 'live_open_pool';
    NEW.pool_status := 'new';
    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (NEW.id, NULL, NULL, 'weekend_saturday_pool', 'Saturday: all leads → Open Pool (self-serve)');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN NEW;
  END IF;

  -- ================================================================
  -- Weekday: original logic
  -- ================================================================
  PERFORM public.reset_daily_caps();

  SELECT id, COALESCE(flow_mode,'round_robin'), COALESCE(alternating_next,'rr')
    INTO v_settings_id, v_flow_mode, v_alt_next
  FROM public.lead_distribution_settings
  WHERE team_id IS NULL
  LIMIT 1;

  IF NEW.assigned_to IS NOT NULL THEN
    v_preassigned := NEW.assigned_to;
    SELECT COALESCE(paused, false), COALESCE(assignment_mode,'round_robin')
      INTO v_preassigned_paused, v_preassigned_mode
    FROM public.agent_distribution_caps WHERE admin_user_id = v_preassigned;
    v_preassigned_works_new := public.agent_works_new_leads(v_preassigned);

    IF v_preassigned_paused THEN
      BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'paused_reroute', format('preassigned agent %s is paused', v_preassigned));
      EXCEPTION WHEN OTHERS THEN NULL; END;
      NEW.assigned_to := NULL;
    ELSIF v_preassigned_mode = 'open_pool' THEN
      BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'open_pool_reroute', format('preassigned agent %s is on Open Pool', v_preassigned));
      EXCEPTION WHEN OTHERS THEN NULL; END;
      NEW.assigned_to := NULL;
    ELSIF NOT v_preassigned_works_new THEN
      BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'workstream_reroute', format('preassigned agent %s not on New Leads', v_preassigned));
      EXCEPTION WHEN OTHERS THEN NULL; END;
      NEW.assigned_to := NULL;
    ELSE
      v_cap_check := public.enforce_agent_cap(v_preassigned, false);
      IF (v_cap_check->>'ok')::boolean THEN
        UPDATE public.agent_distribution_caps
        SET assigned_today = COALESCE(assigned_today,0) + 1, last_assigned_at = now()
        WHERE admin_user_id = v_preassigned;
        RETURN NEW;
      END IF;
      BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'cap_reroute', format('preassigned agent at cap (%s/%s)', v_cap_check->>'current', v_cap_check->>'cap'));
      EXCEPTION WHEN OTHERS THEN NULL; END;
      NEW.assigned_to := NULL;
    END IF;
  END IF;

  IF v_flow_mode = 'open_pool_only' THEN
    BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (NEW.id, NULL, NULL, 'flow_mode_pool_only', 'flow_mode=open_pool_only');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN NEW;
  END IF;

  IF v_flow_mode = 'alternating' AND v_alt_next = 'pool' THEN
    IF v_settings_id IS NOT NULL THEN
      UPDATE public.lead_distribution_settings
      SET alternating_next = 'rr', alternating_counter_date = CURRENT_DATE, updated_at = now()
      WHERE id = v_settings_id;
    END IF;
    BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (NEW.id, NULL, NULL, 'alternating_pool_slot', 'alternating flow: this slot → Open Pool');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN NEW;
  END IF;

  SELECT COALESCE((setting_value)::text::boolean, false) INTO v_routing_enabled
  FROM public.lead_settings WHERE setting_key = 'team_routing_enabled' LIMIT 1;

  v_source := COALESCE(NEW.lead_source::text, 'unknown');

  IF v_routing_enabled THEN
    FOR v_team_rule IN
      WITH eligible_rules AS (
        SELECT r.team_id, t.name AS team_name, r.priority, r.created_at,
               GREATEST(COALESCE(r.percentage, CASE WHEN r.allowed THEN 100 ELSE 0 END), 0)::numeric AS percentage,
               r.daily_cap, r.overflow_team_id
        FROM public.lead_team_source_rules r
        JOIN public.lead_teams t ON t.id = r.team_id
        WHERE r.allowed = true AND t.is_active = true AND r.source = v_source
          AND GREATEST(COALESCE(r.percentage, CASE WHEN r.allowed THEN 100 ELSE 0 END), 0) > 0
      ), team_counts AS (
        SELECT er.team_id, COUNT(sl.id)::numeric AS assigned_count
        FROM eligible_rules er
        LEFT JOIN public.lead_team_members tm ON tm.team_id = er.team_id
        LEFT JOIN public.sales_leads sl ON sl.assigned_to = tm.admin_user_id
          AND sl.created_at >= date_trunc('day', now())
          AND COALESCE(sl.lead_source::text, 'unknown') = v_source
        GROUP BY er.team_id
      ), totals AS (
        SELECT COALESCE(SUM(assigned_count), 0) AS total_assigned FROM team_counts
      )
      SELECT er.team_id, er.team_name, er.priority, er.percentage, er.daily_cap, er.overflow_team_id,
             tc.assigned_count
      FROM eligible_rules er
      JOIN team_counts tc ON tc.team_id = er.team_id
      CROSS JOIN totals tot
      ORDER BY er.priority ASC,
        ((er.percentage / 100.0) * (tot.total_assigned + 1)) - tc.assigned_count DESC,
        er.created_at ASC
    LOOP
      v_target_team := v_team_rule.team_id;
      v_overflow_hops := 0;
      v_visited := ARRAY[]::uuid[];

      IF v_team_rule.daily_cap IS NOT NULL AND v_team_rule.assigned_count >= v_team_rule.daily_cap THEN
        BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
          VALUES (NEW.id, NULL, NULL, 'team_cap_hit',
                  format('team %s hit daily cap %s/%s for %s', v_team_rule.team_name, v_team_rule.assigned_count, v_team_rule.daily_cap, v_source));
        EXCEPTION WHEN OTHERS THEN NULL; END;

        v_overflow_id := v_team_rule.overflow_team_id;
        WHILE v_overflow_id IS NOT NULL AND v_overflow_hops < 5 LOOP
          IF v_overflow_id = ANY(v_visited) THEN EXIT; END IF;
          v_visited := v_visited || v_overflow_id;
          v_assigned := public.pick_agent_for_distribution(v_overflow_id, v_source);
          IF v_assigned IS NOT NULL THEN
            NEW.assigned_to := v_assigned;
            BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
              VALUES (NEW.id, v_assigned, NULL, 'overflow_routed',
                      format('overflow from %s → team %s', v_team_rule.team_name, v_overflow_id));
            EXCEPTION WHEN OTHERS THEN NULL; END;
            IF v_flow_mode = 'alternating' AND v_settings_id IS NOT NULL THEN
              UPDATE public.lead_distribution_settings
              SET alternating_next = 'pool', alternating_counter_date = CURRENT_DATE, updated_at = now()
              WHERE id = v_settings_id;
            END IF;
            RETURN NEW;
          END IF;
          SELECT overflow_team_id INTO v_overflow_id
          FROM public.lead_team_source_rules
          WHERE team_id = v_overflow_id AND source = v_source
          LIMIT 1;
          v_overflow_hops := v_overflow_hops + 1;
        END LOOP;
        CONTINUE;
      END IF;

      v_assigned := public.pick_agent_for_distribution(v_target_team, v_source);
      IF v_assigned IS NOT NULL THEN
        NEW.assigned_to := v_assigned;
        IF v_flow_mode = 'alternating' AND v_settings_id IS NOT NULL THEN
          UPDATE public.lead_distribution_settings
          SET alternating_next = 'pool', alternating_counter_date = CURRENT_DATE, updated_at = now()
          WHERE id = v_settings_id;
        END IF;
        RETURN NEW;
      END IF;
    END LOOP;
  END IF;

  v_assigned := public.pick_agent_for_distribution(NULL, v_source);
  IF v_assigned IS NOT NULL THEN
    NEW.assigned_to := v_assigned;
    IF v_flow_mode = 'alternating' AND v_settings_id IS NOT NULL THEN
      UPDATE public.lead_distribution_settings
      SET alternating_next = 'pool', alternating_counter_date = CURRENT_DATE, updated_at = now()
      WHERE id = v_settings_id;
    END IF;
    RETURN NEW;
  END IF;

  IF v_flow_mode = 'alternating' THEN
    BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (NEW.id, NULL, NULL, 'alternating_rr_spill', 'alternating: RR pool empty/capped');
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  RETURN NEW;
END;
$function$;


-- =====================================================================
-- Recycle function: weekend-aware
--   Saturday: 10-min pool→RR (from 15), cap override so online agents
--             can take unlimited on the skeleton day
--   Sunday:   recycle disabled (solo agent = whole team; nowhere to RR to)
--   Weekdays: unchanged (15 min pool→RR, 30 min RR→pool, max 2 cycles)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.open_pool_recycle_stale()
RETURNS TABLE(
  promoted_to_rr integer,
  returned_to_pool integer,
  flagged_stale integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _lead RECORD;
  _agent uuid;
  _cap jsonb;
  _promoted int := 0;
  _returned int := 0;
  _flagged int := 0;
  _uk_dow int;
  _pool_stale_minutes int;
  _cap_override boolean;
BEGIN
  _uk_dow := EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/London'))::int;

  -- Sunday: skip recycling entirely (solo agent = whole team)
  IF _uk_dow = 0 THEN
    promoted_to_rr := 0; returned_to_pool := 0; flagged_stale := 0;
    RETURN NEXT; RETURN;
  END IF;

  IF _uk_dow = 6 THEN
    _pool_stale_minutes := 10;
    _cap_override := true;
  ELSE
    _pool_stale_minutes := 15;
    _cap_override := false;
  END IF;

  PERFORM public.reset_daily_caps();

  -- Phase 1: Pool → RR
  FOR _lead IN
    SELECT id, lead_source, pool_recycle_count
      FROM public.sales_leads
     WHERE queue = 'live_open_pool'
       AND assigned_to IS NULL
       AND owner_agent IS NULL
       AND status NOT IN ('lost','converted','fake_lead')
       AND (pool_status IS NULL OR pool_status IN ('new','callback_booked','contacted'))
       AND (locked_by IS NULL OR locked_at < now() - interval '7 minutes')
       AND COALESCE(pool_recycle_count, 0) < 2
       AND COALESCE(last_action_at, created_at) < now() - make_interval(mins => _pool_stale_minutes)
     ORDER BY COALESCE(priority_score, 0) DESC, created_at ASC
     LIMIT 200
     FOR UPDATE SKIP LOCKED
  LOOP
    _agent := public.pick_agent_for_distribution(NULL, COALESCE(_lead.lead_source::text,'unknown'));
    IF _agent IS NULL THEN CONTINUE; END IF;

    IF NOT _cap_override THEN
      _cap := public.enforce_agent_cap(_agent, false);
      IF NOT (_cap->>'ok')::boolean THEN CONTINUE; END IF;
    END IF;

    UPDATE public.sales_leads
       SET assigned_to        = _agent,
           owner_agent        = _agent,
           assigned_at        = COALESCE(assigned_at, now()),
           queue              = 'live_new',
           pool_status        = 'new',
           last_action_at     = now(),
           updated_at         = now(),
           pool_recycle_count = COALESCE(pool_recycle_count, 0) + 1,
           auto_tags = (
             SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['recycled_from_pool']))
           )
     WHERE id = _lead.id;

    UPDATE public.agent_distribution_caps
       SET assigned_today = COALESCE(assigned_today,0) + 1,
           last_assigned_at = now()
     WHERE admin_user_id = _agent;

    DELETE FROM public.shark_tank_pool WHERE lead_id = _lead.id;

    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (_lead.id, _agent, NULL, 'pool_stale_recycled_to_rr',
              format('Stale >%smin in Open Pool → RR (cycle %s/2)', _pool_stale_minutes, COALESCE(_lead.pool_recycle_count,0)+1));
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      INSERT INTO public.lead_activities (lead_id, activity_type, description)
      VALUES (_lead.id, 'system',
              format('Auto-recycled from Open Pool to agent (stale >%smin, cycle %s/2)',
                     _pool_stale_minutes, COALESCE(_lead.pool_recycle_count,0)+1));
    EXCEPTION WHEN OTHERS THEN NULL; END;

    _promoted := _promoted + 1;
  END LOOP;

  -- Phase 2: RR → Pool
  FOR _lead IN
    SELECT id, pool_recycle_count
      FROM public.sales_leads
     WHERE queue = 'live_new'
       AND assigned_to IS NOT NULL
       AND status NOT IN ('lost','converted','fake_lead')
       AND COALESCE(pool_status,'new') = 'new'
       AND 'recycled_from_pool' = ANY(COALESCE(auto_tags, ARRAY[]::text[]))
       AND COALESCE(pool_recycle_count, 0) < 2
       AND COALESCE(last_action_at, assigned_at, created_at) < now() - interval '30 minutes'
     ORDER BY assigned_at ASC
     LIMIT 200
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.sales_leads
       SET assigned_to    = NULL,
           owner_agent    = NULL,
           queue          = 'live_open_pool',
           pool_status    = 'new',
           locked_by      = NULL,
           locked_at      = NULL,
           last_action_at = now(),
           updated_at     = now()
     WHERE id = _lead.id;

    BEGIN
      INSERT INTO public.shark_tank_pool(lead_id, team_id, status)
      VALUES (_lead.id, NULL, 'queued')
      ON CONFLICT (lead_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (_lead.id, NULL, NULL, 'rr_stale_returned_to_pool',
              format('Agent inactive >30min → returned to Open Pool (cycle %s used)', _lead.pool_recycle_count));
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      INSERT INTO public.lead_activities (lead_id, activity_type, description)
      VALUES (_lead.id, 'system', 'Returned to Open Pool — agent inactive >30min');
    EXCEPTION WHEN OTHERS THEN NULL; END;

    _returned := _returned + 1;
  END LOOP;

  -- Phase 3: escalate stale after 2 cycles
  FOR _lead IN
    SELECT id
      FROM public.sales_leads
     WHERE status NOT IN ('lost','converted','fake_lead')
       AND COALESCE(pool_status,'new') IN ('new','callback_booked','contacted')
       AND COALESCE(pool_recycle_count, 0) >= 2
       AND NOT ('stale_needs_manager' = ANY(COALESCE(auto_tags, ARRAY[]::text[])))
       AND COALESCE(last_action_at, assigned_at, created_at) < now() - interval '30 minutes'
     LIMIT 200
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.sales_leads
       SET auto_tags = (
             SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['stale_needs_manager']))
           ),
           updated_at = now()
     WHERE id = _lead.id;

    BEGIN
      INSERT INTO public.lead_activities (lead_id, activity_type, description)
      VALUES (_lead.id, 'system', 'Flagged stale — used 2 recycle cycles, needs manager attention');
    EXCEPTION WHEN OTHERS THEN NULL; END;

    _flagged := _flagged + 1;
  END LOOP;

  promoted_to_rr := _promoted;
  returned_to_pool := _returned;
  flagged_stale := _flagged;
  RETURN NEXT;
END;
$function$;


-- =====================================================================
-- Morning drain: gate to Mon–Fri only (skip Sat/Sun)
-- The cron cron entries stay Mon–Sat but we no-op inside on Sat.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.open_pool_drain_morning_queue(
  _max_leads integer DEFAULT 500
)
RETURNS TABLE(
  assigned_rr integer,
  assigned_pool integer,
  skipped integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller_role text;
  _lead RECORD;
  _agent uuid;
  _cap jsonb;
  _next_slot text := 'rr';
  _rr_count int := 0;
  _pool_count int := 0;
  _skipped int := 0;
  _uk_dow int;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO _caller_role
      FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = true
     LIMIT 1;
    IF _caller_role IS NULL OR _caller_role NOT IN ('admin','super_admin','sales_manager') THEN
      RAISE EXCEPTION 'Not authorized to drain morning queue';
    END IF;
  END IF;

  -- Skip weekends when called by cron. Manager manual clicks still work
  -- because the RAISE above already returned success for management.
  _uk_dow := EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/London'))::int;
  IF auth.uid() IS NULL AND _uk_dow IN (0, 6) THEN
    assigned_rr := 0; assigned_pool := 0; skipped := 0;
    RETURN NEXT; RETURN;
  END IF;

  PERFORM public.reset_daily_caps();

  FOR _lead IN
    SELECT id, lead_source
      FROM public.sales_leads
     WHERE queue = 'morning_call_queue'
       AND assigned_to IS NULL
       AND owner_agent IS NULL
       AND status NOT IN ('lost','converted','fake_lead')
       AND (pool_status IS NULL OR pool_status IN ('new','callback_booked','contacted'))
       AND (locked_by IS NULL OR locked_at < now() - interval '7 minutes')
     ORDER BY COALESCE(priority_score, 0) DESC, created_at ASC
     LIMIT _max_leads
     FOR UPDATE SKIP LOCKED
  LOOP
    _agent := NULL;

    IF _next_slot = 'rr' THEN
      _agent := public.pick_agent_for_distribution(NULL, COALESCE(_lead.lead_source::text,'unknown'));

      IF _agent IS NOT NULL THEN
        _cap := public.enforce_agent_cap(_agent, false);
        IF NOT (_cap->>'ok')::boolean THEN _agent := NULL; END IF;
      END IF;

      IF _agent IS NOT NULL THEN
        UPDATE public.sales_leads
           SET assigned_to    = _agent,
               owner_agent    = _agent,
               assigned_at    = COALESCE(assigned_at, now()),
               queue          = 'live_new',
               pool_status    = 'new',
               last_action_at = now(),
               updated_at     = now()
         WHERE id = _lead.id;

        UPDATE public.agent_distribution_caps
           SET assigned_today   = COALESCE(assigned_today,0) + 1,
               last_assigned_at = now()
         WHERE admin_user_id = _agent;

        BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
          VALUES (_lead.id, _agent, NULL, 'morning_drain_rr', 'Morning queue drain → round-robin');
        EXCEPTION WHEN OTHERS THEN NULL; END;

        BEGIN INSERT INTO public.lead_activities (lead_id, activity_type, description)
          VALUES (_lead.id, 'system', 'Morning queue drained to round-robin agent');
        EXCEPTION WHEN OTHERS THEN NULL; END;

        _rr_count := _rr_count + 1;
        _next_slot := 'pool';
        CONTINUE;
      END IF;
    END IF;

    UPDATE public.sales_leads
       SET queue          = 'live_open_pool',
           pool_status    = 'new',
           last_action_at = now(),
           updated_at     = now()
     WHERE id = _lead.id;

    BEGIN INSERT INTO public.shark_tank_pool(lead_id, team_id, status)
      VALUES (_lead.id, NULL, 'queued') ON CONFLICT (lead_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN INSERT INTO public.shark_tank_audit(lead_id, action, payload)
      VALUES (_lead.id, 'queued', jsonb_build_object('via','morning_drain'));
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (_lead.id, NULL, NULL, 'morning_drain_pool', 'Morning queue drain → Open Pool');
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN INSERT INTO public.lead_activities (lead_id, activity_type, description)
      VALUES (_lead.id, 'system', 'Morning queue drained to Open Pool (self-serve)');
    EXCEPTION WHEN OTHERS THEN NULL; END;

    _pool_count := _pool_count + 1;
    _next_slot := 'rr';
  END LOOP;

  assigned_rr := _rr_count;
  assigned_pool := _pool_count;
  skipped := _skipped;
  RETURN NEXT;
END;
$function$;
