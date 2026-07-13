
-- 1. Extend lead_team_source_rules with cap and overflow team
ALTER TABLE public.lead_team_source_rules
  ADD COLUMN IF NOT EXISTS daily_cap integer,
  ADD COLUMN IF NOT EXISTS overflow_team_id uuid REFERENCES public.lead_teams(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lead_team_source_rules.daily_cap IS 'Max leads/day for this (team, source). NULL = unlimited.';
COMMENT ON COLUMN public.lead_team_source_rules.overflow_team_id IS 'Team that receives leads for this source once the daily cap is hit. NULL = fall through to next team by share debt, then global pool.';

-- 2. Router: honour daily cap + overflow team
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
BEGIN
  IF NEW.status IN ('lost', 'fake_lead') THEN
    RETURN NEW;
  END IF;

  PERFORM public.reset_daily_caps();

  SELECT id, COALESCE(flow_mode,'round_robin'), COALESCE(alternating_next,'rr')
    INTO v_settings_id, v_flow_mode, v_alt_next
  FROM public.lead_distribution_settings
  WHERE team_id IS NULL
  LIMIT 1;

  -- Preassigned agent handling (unchanged)
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

  -- Flow mode overrides
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
      -- Cap check: if hit, follow overflow chain
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
          -- follow chain
          SELECT overflow_team_id INTO v_overflow_id
          FROM public.lead_team_source_rules
          WHERE team_id = v_overflow_id AND source = v_source
          LIMIT 1;
          v_overflow_hops := v_overflow_hops + 1;
        END LOOP;
        CONTINUE;  -- try next team in the outer share-debt loop
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

-- 3. Simulator: surface cap + overflow decisions
CREATE OR REPLACE FUNCTION public.simulate_lead_routing(p_source text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled boolean := false;
  v_rule RECORD;
  v_agent uuid;
  v_agent_name text;
  v_steps jsonb := '[]'::jsonb;
  v_source text;
  v_overflow_id uuid;
  v_overflow_name text;
BEGIN
  SELECT COALESCE((setting_value)::text::boolean, false) INTO v_enabled
  FROM public.lead_settings WHERE setting_key = 'team_routing_enabled' LIMIT 1;

  v_source := CASE COALESCE(p_source, 'unknown')
    WHEN 'social_ad' THEN 'facebook'
    WHEN 'google_ad' THEN 'google'
    WHEN 'website' THEN 'organic'
    ELSE COALESCE(p_source, 'unknown')
  END;

  v_steps := v_steps || jsonb_build_object(
    'gate', 'master_switch',
    'state', CASE WHEN v_enabled THEN 'ARMED' ELSE 'OFF' END,
    'incoming_source', p_source,
    'matched_rule_source', v_source
  );

  IF v_enabled THEN
    FOR v_rule IN
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
          AND CASE COALESCE(sl.lead_source::text, 'unknown')
            WHEN 'social_ad' THEN 'facebook'
            WHEN 'google_ad' THEN 'google'
            WHEN 'website' THEN 'organic'
            ELSE COALESCE(sl.lead_source::text, 'unknown')
          END = v_source
        GROUP BY er.team_id
      ), totals AS (
        SELECT COALESCE(SUM(assigned_count), 0) AS total_assigned FROM team_counts
      )
      SELECT er.team_id, er.team_name, er.priority, er.percentage, er.daily_cap, er.overflow_team_id,
             tc.assigned_count,
             ((er.percentage / 100.0) * (tot.total_assigned + 1)) - tc.assigned_count AS need_score
      FROM eligible_rules er
      JOIN team_counts tc ON tc.team_id = er.team_id
      CROSS JOIN totals tot
      ORDER BY need_score DESC, er.priority ASC, er.created_at ASC
    LOOP
      -- Cap gate
      IF v_rule.daily_cap IS NOT NULL AND v_rule.assigned_count >= v_rule.daily_cap THEN
        SELECT name INTO v_overflow_name FROM public.lead_teams WHERE id = v_rule.overflow_team_id;
        v_steps := v_steps || jsonb_build_object(
          'gate', 'team_candidate',
          'team', v_rule.team_name,
          'percentage', v_rule.percentage,
          'assigned_today', v_rule.assigned_count,
          'daily_cap', v_rule.daily_cap,
          'cap_hit', true,
          'overflow_to', v_overflow_name
        );

        IF v_rule.overflow_team_id IS NOT NULL THEN
          SELECT adc.admin_user_id INTO v_agent
          FROM public.agent_distribution_caps adc
          JOIN public.admin_users au ON au.id = adc.admin_user_id
          WHERE au.is_active = true
            AND (adc.paused IS NULL OR adc.paused = false)
            AND au.role IN ('sales','sales_lead')
            AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
            AND public.is_agent_on_duty(adc.admin_user_id)
            AND EXISTS (
              SELECT 1 FROM public.lead_team_members ltm
              WHERE ltm.team_id = v_rule.overflow_team_id
                AND ltm.admin_user_id = adc.admin_user_id
                AND ltm.workstream_new_leads = true
            )
          ORDER BY adc.sort_order ASC, adc.last_assigned_at ASC NULLS FIRST
          LIMIT 1;

          SELECT COALESCE(NULLIF(concat_ws(' ', first_name, last_name), ''), email) INTO v_agent_name
          FROM public.admin_users WHERE id = v_agent;

          v_steps := v_steps || jsonb_build_object(
            'gate', 'overflow',
            'from_team', v_rule.team_name,
            'to_team', v_overflow_name,
            'picked_agent', v_agent,
            'picked_agent_name', v_agent_name
          );

          IF v_agent IS NOT NULL THEN
            RETURN jsonb_build_object(
              'outcome', 'team_routed',
              'team', v_overflow_name,
              'via_overflow_from', v_rule.team_name,
              'agent_id', v_agent,
              'agent_name', v_agent_name,
              'matched_rule_source', v_source,
              'steps', v_steps
            );
          END IF;
        END IF;
        CONTINUE;
      END IF;

      SELECT adc.admin_user_id INTO v_agent
      FROM public.agent_distribution_caps adc
      JOIN public.admin_users au ON au.id = adc.admin_user_id
      WHERE au.is_active = true
        AND (adc.paused IS NULL OR adc.paused = false)
        AND au.role IN ('sales','sales_lead')
        AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
        AND public.is_agent_on_duty(adc.admin_user_id)
        AND EXISTS (
          SELECT 1 FROM public.lead_team_members ltm
          WHERE ltm.team_id = v_rule.team_id
            AND ltm.admin_user_id = adc.admin_user_id
            AND ltm.workstream_new_leads = true
        )
      ORDER BY adc.sort_order ASC, adc.last_assigned_at ASC NULLS FIRST
      LIMIT 1;

      SELECT COALESCE(NULLIF(concat_ws(' ', first_name, last_name), ''), email) INTO v_agent_name
      FROM public.admin_users WHERE id = v_agent;

      v_steps := v_steps || jsonb_build_object(
        'gate', 'team_candidate',
        'team', v_rule.team_name,
        'priority', v_rule.priority,
        'percentage', v_rule.percentage,
        'assigned_today', v_rule.assigned_count,
        'daily_cap', v_rule.daily_cap,
        'need_score', v_rule.need_score,
        'picked_agent', v_agent,
        'picked_agent_name', v_agent_name
      );

      IF v_agent IS NOT NULL THEN
        RETURN jsonb_build_object(
          'outcome', 'team_routed',
          'team', v_rule.team_name,
          'agent_id', v_agent,
          'agent_name', v_agent_name,
          'matched_rule_source', v_source,
          'steps', v_steps
        );
      END IF;
    END LOOP;
  END IF;

  SELECT adc.admin_user_id INTO v_agent
  FROM public.agent_distribution_caps adc
  JOIN public.admin_users au ON au.id = adc.admin_user_id
  WHERE au.is_active = true
    AND (adc.paused IS NULL OR adc.paused = false)
    AND au.role IN ('sales','sales_lead')
    AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
    AND public.is_agent_on_duty(adc.admin_user_id)
  ORDER BY adc.sort_order ASC, adc.last_assigned_at ASC NULLS FIRST
  LIMIT 1;

  SELECT COALESCE(NULLIF(concat_ws(' ', first_name, last_name), ''), email) INTO v_agent_name
  FROM public.admin_users WHERE id = v_agent;

  RETURN jsonb_build_object(
    'outcome', CASE WHEN v_agent IS NULL THEN 'no_agent_available' ELSE 'global_fallback' END,
    'agent_id', v_agent,
    'agent_name', v_agent_name,
    'matched_rule_source', v_source,
    'steps', v_steps || jsonb_build_object('gate', 'global_fallback', 'picked_agent', v_agent, 'picked_agent_name', v_agent_name)
  );
END;
$function$;
