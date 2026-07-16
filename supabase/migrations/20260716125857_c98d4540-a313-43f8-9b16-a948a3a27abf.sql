
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
  v_uk_dow int;
  v_sunday_ids uuid[] := ARRAY[]::uuid[];
  v_legacy_solo uuid;
  v_sunday_pick uuid;
BEGIN
  IF NEW.status IN ('lost', 'fake_lead') THEN
    RETURN NEW;
  END IF;

  v_uk_dow := EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/London'))::int;

  IF v_uk_dow = 0 THEN
    BEGIN
      SELECT COALESCE(
               ARRAY(
                 SELECT (jsonb_array_elements_text(setting_value))::uuid
                 FROM public.lead_settings
                 WHERE setting_key = 'weekend_sunday_roster'
               ),
               ARRAY[]::uuid[]
             )
        INTO v_sunday_ids;
    EXCEPTION WHEN OTHERS THEN v_sunday_ids := ARRAY[]::uuid[]; END;

    IF array_length(v_sunday_ids, 1) IS NULL THEN
      BEGIN
        SELECT (setting_value #>> '{}')::uuid INTO v_legacy_solo
          FROM public.lead_settings
         WHERE setting_key = 'weekend_solo_agent_id'
         LIMIT 1;
      EXCEPTION WHEN OTHERS THEN v_legacy_solo := NULL; END;
      IF v_legacy_solo IS NOT NULL THEN
        v_sunday_ids := ARRAY[v_legacy_solo];
      END IF;
    END IF;

    IF array_length(v_sunday_ids, 1) IS NOT NULL THEN
      SELECT au.id INTO v_sunday_pick
        FROM public.admin_users au
        LEFT JOIN public.agent_distribution_caps c ON c.admin_user_id = au.id
       WHERE au.id = ANY(v_sunday_ids)
         AND au.is_active = true
       ORDER BY COALESCE(c.last_assigned_at, 'epoch'::timestamptz) ASC,
                COALESCE(c.assigned_today, 0) ASC,
                au.id ASC
       LIMIT 1;
    END IF;

    IF v_sunday_pick IS NOT NULL THEN
      NEW.assigned_to := v_sunday_pick;
      NEW.owner_agent := v_sunday_pick;
      NEW.assigned_at := now();
      NEW.queue := 'live_new';
      BEGIN
        UPDATE public.agent_distribution_caps
           SET last_assigned_at = now()
         WHERE admin_user_id = v_sunday_pick;
      EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN
        INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, v_sunday_pick, NULL, 'weekend_sunday_roster',
                format('Sunday roster round-robin (%s eligible)', array_length(v_sunday_ids,1)));
      EXCEPTION WHEN OTHERS THEN NULL; END;
      RETURN NEW;
    END IF;

    NEW.assigned_to := NULL;
    NEW.owner_agent := NULL;
    NEW.queue := 'live_open_pool';
    NEW.pool_status := 'new';
    NEW.auto_tags := (
      SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(NEW.auto_tags, ARRAY[]::text[]) || ARRAY['sunday_coverage_down']))
    );
    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (NEW.id, NULL, NULL, 'weekend_sunday_coverage_down', 'Sunday: no active roster agents → parked in Open Pool');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN NEW;
  END IF;

  IF v_uk_dow = 6 THEN
    NEW.assigned_to := NULL;
    NEW.owner_agent := NULL;
    NEW.queue := 'live_open_pool';
    NEW.pool_status := 'new';
    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (NEW.id, NULL, NULL, 'weekend_saturday_pool', 'Saturday: all leads → Open Pool (self-serve)');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN NEW;
  END IF;

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
    NEW.assigned_to := NULL;
    NEW.owner_agent := NULL;
    NEW.queue := 'live_open_pool';
    NEW.pool_status := 'new';
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
    NEW.assigned_to := NULL;
    NEW.owner_agent := NULL;
    NEW.queue := 'live_open_pool';
    NEW.pool_status := 'new';
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
    NEW.assigned_to := NULL;
    NEW.owner_agent := NULL;
    NEW.queue := 'live_open_pool';
    NEW.pool_status := 'new';
    BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (NEW.id, NULL, NULL, 'alternating_rr_spill', 'alternating: RR pool empty/capped → parked in Open Pool');
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  RETURN NEW;
END;
$function$;
