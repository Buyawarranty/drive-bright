
-- 1. Extend distribution settings with flow-mode fields
ALTER TABLE public.lead_distribution_settings
  ADD COLUMN IF NOT EXISTS flow_mode text NOT NULL DEFAULT 'round_robin',
  ADD COLUMN IF NOT EXISTS alternating_next text NOT NULL DEFAULT 'rr',
  ADD COLUMN IF NOT EXISTS alternating_counter_date date;

ALTER TABLE public.lead_distribution_settings
  DROP CONSTRAINT IF EXISTS lead_distribution_settings_flow_mode_check;
ALTER TABLE public.lead_distribution_settings
  ADD CONSTRAINT lead_distribution_settings_flow_mode_check
  CHECK (flow_mode IN ('round_robin','alternating','open_pool_only'));

ALTER TABLE public.lead_distribution_settings
  DROP CONSTRAINT IF EXISTS lead_distribution_settings_alt_next_check;
ALTER TABLE public.lead_distribution_settings
  ADD CONSTRAINT lead_distribution_settings_alt_next_check
  CHECK (alternating_next IN ('rr','pool'));

-- 2. Extend reset_daily_caps to also reset the alternating counter each day
CREATE OR REPLACE FUNCTION public.reset_daily_caps()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE agent_distribution_caps
    SET assigned_today = 0,
        cap_reset_date = CURRENT_DATE,
        updated_at = now()
    WHERE cap_reset_date IS NULL OR cap_reset_date < CURRENT_DATE;

    -- Reset alternating counter to 'rr' at the start of each new day
    UPDATE public.lead_distribution_settings
    SET alternating_next = 'rr',
        alternating_counter_date = CURRENT_DATE,
        updated_at = now()
    WHERE alternating_counter_date IS NULL
       OR alternating_counter_date < CURRENT_DATE;
END;
$function$;

-- 3. Rewrite the assignment trigger to honour flow_mode
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
BEGIN
  IF NEW.status IN ('lost', 'fake_lead') THEN
    RETURN NEW;
  END IF;

  PERFORM public.reset_daily_caps();

  -- Load global flow settings
  SELECT id, COALESCE(flow_mode,'round_robin'), COALESCE(alternating_next,'rr')
    INTO v_settings_id, v_flow_mode, v_alt_next
  FROM public.lead_distribution_settings
  WHERE team_id IS NULL
  LIMIT 1;

  -- Preassigned agent handling (respect explicit assigned_to as before)
  IF NEW.assigned_to IS NOT NULL THEN
    v_preassigned := NEW.assigned_to;

    SELECT COALESCE(paused, false), COALESCE(assignment_mode,'round_robin')
      INTO v_preassigned_paused, v_preassigned_mode
    FROM public.agent_distribution_caps
    WHERE admin_user_id = v_preassigned;

    v_preassigned_works_new := public.agent_works_new_leads(v_preassigned);

    IF v_preassigned_paused THEN
      BEGIN
        INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'paused_reroute',
                format('preassigned agent %s is paused — falling through to router', v_preassigned));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      NEW.assigned_to := NULL;
    ELSIF v_preassigned_mode = 'open_pool' THEN
      BEGIN
        INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'open_pool_reroute',
                format('preassigned agent %s is on Open Pool — releasing to pool', v_preassigned));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      NEW.assigned_to := NULL;
    ELSIF NOT v_preassigned_works_new THEN
      BEGIN
        INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'workstream_reroute',
                format('preassigned agent %s not on New Leads workstream — falling through', v_preassigned));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      NEW.assigned_to := NULL;
    ELSE
      v_cap_check := public.enforce_agent_cap(v_preassigned, false);

      IF (v_cap_check->>'ok')::boolean THEN
        UPDATE public.agent_distribution_caps
        SET assigned_today = COALESCE(assigned_today,0) + 1,
            last_assigned_at = now()
        WHERE admin_user_id = v_preassigned;
        RETURN NEW;
      END IF;

      BEGIN
        INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'cap_reroute',
                format('preassigned agent at cap (%s/%s)', v_cap_check->>'current', v_cap_check->>'cap'));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      NEW.assigned_to := NULL;
    END IF;
  END IF;

  -- Flow mode overrides
  IF v_flow_mode = 'open_pool_only' THEN
    -- Skip all router logic; leave unassigned so the lead lands in Open Pool
    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (NEW.id, NULL, NULL, 'flow_mode_pool_only',
              'flow_mode=open_pool_only — routed to Open Pool');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN NEW;
  END IF;

  IF v_flow_mode = 'alternating' THEN
    IF v_alt_next = 'pool' THEN
      -- This lead's slot belongs to the Open Pool
      v_send_to_pool := true;

      -- Flip the counter to 'rr' for the next lead
      IF v_settings_id IS NOT NULL THEN
        UPDATE public.lead_distribution_settings
        SET alternating_next = 'rr',
            alternating_counter_date = CURRENT_DATE,
            updated_at = now()
        WHERE id = v_settings_id;
      END IF;

      BEGIN
        INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'alternating_pool_slot',
                'alternating flow: this lead slot → Open Pool');
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

      RETURN NEW;
    END IF;
    -- v_alt_next = 'rr' → continue to router below; we'll flip only if router succeeds
  END IF;

  -- Team-source routing (preserved)
  SELECT COALESCE((setting_value)::text::boolean, false)
    INTO v_routing_enabled
  FROM public.lead_settings
  WHERE setting_key = 'team_routing_enabled'
  LIMIT 1;

  v_source := COALESCE(NEW.lead_source::text, 'unknown');

  IF v_routing_enabled THEN
    FOR v_team_rule IN
      WITH eligible_rules AS (
        SELECT r.team_id, t.name AS team_name, r.priority, r.created_at,
               GREATEST(COALESCE(r.percentage, CASE WHEN r.allowed THEN 100 ELSE 0 END), 0)::numeric AS percentage
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
      SELECT er.team_id
      FROM eligible_rules er
      JOIN team_counts tc ON tc.team_id = er.team_id
      CROSS JOIN totals tot
      ORDER BY er.priority ASC,
        ((er.percentage / 100.0) * (tot.total_assigned + 1)) - tc.assigned_count DESC,
        er.created_at ASC
    LOOP
      v_assigned := public.pick_agent_for_distribution(v_team_rule.team_id, v_source);
      IF v_assigned IS NOT NULL THEN
        NEW.assigned_to := v_assigned;
        -- In alternating mode, flip counter now that RR slot was filled
        IF v_flow_mode = 'alternating' AND v_settings_id IS NOT NULL THEN
          UPDATE public.lead_distribution_settings
          SET alternating_next = 'pool',
              alternating_counter_date = CURRENT_DATE,
              updated_at = now()
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
      SET alternating_next = 'pool',
          alternating_counter_date = CURRENT_DATE,
          updated_at = now()
      WHERE id = v_settings_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Router found nobody. In alternating mode, that means all RR agents are capped —
  -- spill to Open Pool without flipping the counter (so RR still gets first crack next time).
  IF v_flow_mode = 'alternating' THEN
    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (NEW.id, NULL, NULL, 'alternating_rr_spill',
              'alternating flow: RR pool empty/capped — spilling to Open Pool');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

-- Seed defaults on existing settings row(s)
UPDATE public.lead_distribution_settings
   SET alternating_counter_date = COALESCE(alternating_counter_date, CURRENT_DATE),
       alternating_next = COALESCE(alternating_next, 'rr'),
       flow_mode = COALESCE(flow_mode, 'round_robin')
 WHERE flow_mode IS NULL OR alternating_next IS NULL OR alternating_counter_date IS NULL;
