-- Helper: true if the agent has workstream_new_leads on at least one team,
-- OR if they aren't on any team at all (backwards-compatible default).
CREATE OR REPLACE FUNCTION public.agent_works_new_leads(p_admin_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM public.lead_team_members WHERE admin_user_id = p_admin_user_id
      ) THEN true
      ELSE EXISTS (
        SELECT 1 FROM public.lead_team_members
        WHERE admin_user_id = p_admin_user_id
          AND workstream_new_leads = true
      )
    END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_works_new_leads(uuid) TO authenticated, service_role;

-- Patch auto_assign_lead_round_robin: drop pre-assignment when the pre-assigned
-- agent isn't on the New Leads workstream, so it falls through to the pool.
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
BEGIN
  IF NEW.status IN ('lost', 'fake_lead') THEN
    RETURN NEW;
  END IF;

  PERFORM public.reset_daily_caps();

  IF NEW.assigned_to IS NOT NULL THEN
    v_preassigned := NEW.assigned_to;

    SELECT COALESCE(paused, false) INTO v_preassigned_paused
    FROM public.agent_distribution_caps
    WHERE admin_user_id = v_preassigned;

    v_preassigned_works_new := public.agent_works_new_leads(v_preassigned);

    IF v_preassigned_paused THEN
      BEGIN
        INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'paused_reroute',
                format('preassigned agent %s is paused — falling through to round-robin', v_preassigned));
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
        RETURN NEW;
      END IF;
    END LOOP;
  END IF;

  v_assigned := public.pick_agent_for_distribution(NULL, v_source);
  IF v_assigned IS NOT NULL THEN
    NEW.assigned_to := v_assigned;
  END IF;

  RETURN NEW;
END;
$function$;

-- Patch pick_agent_for_distribution: when p_team_id IS NULL (untargeted pool),
-- exclude agents whose workstream doesn't include "New Leads". When p_team_id
-- IS provided the existing workstream_new_leads check on lead_team_members
-- already handles it correctly.
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
  v_last_assigned_id uuid;
  v_last_sort_order int;
  v_last_assigned_at timestamptz;
  v_total_assigned_today int;
  v_rr_id uuid;
  v_any_on_duty boolean;
  v_force_overflow boolean := false;
  v_overflow_recipient RECORD;
  v_last_overflow_id uuid;
  v_last_overflow_sort int;
  v_overflow_rr_id uuid;
  v_mode text;
  v_modes text[] := ARRAY['open_pool','round_robin'];
  v_i int;
BEGIN
  IF p_team_id IS NOT NULL THEN
    SELECT * INTO v_settings FROM public.lead_distribution_settings WHERE team_id = p_team_id LIMIT 1;
    IF v_settings IS NULL THEN
      SELECT * INTO v_settings FROM public.lead_distribution_settings WHERE team_id IS NULL LIMIT 1;
    END IF;
  ELSE
    SELECT * INTO v_settings FROM public.lead_distribution_settings WHERE team_id IS NULL LIMIT 1;
  END IF;

  IF v_settings IS NULL THEN
    v_settings := ROW(NULL, false, NULL, NULL, false, now(), now(), 'round_robin', p_team_id);
  END IF;

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

  FOR v_i IN 1..array_length(v_modes, 1) LOOP
    v_mode := v_modes[v_i];
    v_force_overflow := false;
    v_next_agent := NULL;

    SELECT EXISTS(
      SELECT 1
      FROM public.agent_distribution_caps adc
      JOIN public.admin_users au ON au.id = adc.admin_user_id
      WHERE au.is_active = true
        AND (adc.paused IS NULL OR adc.paused = false)
        AND au.role IN ('sales','sales_lead')
        AND public.is_agent_on_duty(adc.admin_user_id)
        AND COALESCE(adc.assignment_mode,'round_robin') = v_mode
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
        AND (p_team_id IS NOT NULL OR public.agent_works_new_leads(adc.admin_user_id))
    ) INTO v_any_on_duty;

    IF NOT v_any_on_duty THEN
      CONTINUE;
    END IF;

    IF COALESCE(v_settings.distribution_mode, 'round_robin') = 'percentage' THEN
      SELECT COALESCE(SUM(adc.assigned_today),0) INTO v_total_assigned_today
      FROM public.agent_distribution_caps adc
      JOIN public.admin_users au ON au.id = adc.admin_user_id
      WHERE au.is_active = true
        AND (adc.paused IS NULL OR adc.paused = false)
        AND au.role IN ('sales','sales_lead')
        AND COALESCE(adc.percentage,0) > 0
        AND public.is_agent_on_duty(adc.admin_user_id)
        AND COALESCE(adc.assignment_mode,'round_robin') = v_mode
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

      SELECT adc.* INTO v_next_agent
      FROM public.agent_distribution_caps adc
      JOIN public.admin_users au ON au.id = adc.admin_user_id
      WHERE au.is_active = true
        AND (adc.paused IS NULL OR adc.paused = false)
        AND au.role IN ('sales','sales_lead')
        AND COALESCE(adc.percentage,0) > 0
        AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
        AND public.is_agent_on_duty(adc.admin_user_id)
        AND COALESCE(adc.assignment_mode,'round_robin') = v_mode
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
        ((COALESCE(adc.percentage,0)::numeric/100.0) * (v_total_assigned_today + 1)) - COALESCE(adc.assigned_today,0) DESC,
        adc.last_assigned_at ASC NULLS FIRST,
        adc.sort_order ASC
      LIMIT 1;

      IF v_next_agent.admin_user_id IS NOT NULL THEN
        UPDATE public.agent_distribution_caps
        SET assigned_today = COALESCE(assigned_today,0)+1, last_assigned_at = v_now
        WHERE admin_user_id = v_next_agent.admin_user_id;
        RETURN v_next_agent.admin_user_id;
      END IF;
    END IF;

    IF p_team_id IS NULL THEN
      SELECT id, last_assigned_user_id INTO v_rr_id, v_last_assigned_id
      FROM public.round_robin_state WHERE team_id IS NULL LIMIT 1 FOR UPDATE;
    ELSE
      SELECT id, last_assigned_user_id INTO v_rr_id, v_last_assigned_id
      FROM public.round_robin_state WHERE team_id = p_team_id LIMIT 1 FOR UPDATE;
    END IF;

    SELECT sort_order, last_assigned_at INTO v_last_sort_order, v_last_assigned_at
    FROM public.agent_distribution_caps WHERE admin_user_id = v_last_assigned_id;

    SELECT adc.* INTO v_next_agent
    FROM public.agent_distribution_caps adc
    JOIN public.admin_users au ON au.id = adc.admin_user_id
    WHERE au.is_active = true
      AND (adc.paused IS NULL OR adc.paused = false)
      AND au.role IN ('sales','sales_lead')
      AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
      AND public.is_agent_on_duty(adc.admin_user_id)
      AND COALESCE(adc.assignment_mode,'round_robin') = v_mode
      AND adc.admin_user_id <> COALESCE(v_last_assigned_id, '00000000-0000-0000-0000-000000000000'::uuid)
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
      AND (
        v_last_sort_order IS NULL
        OR adc.sort_order > v_last_sort_order
        OR (
          adc.sort_order = v_last_sort_order
          AND (
            adc.last_assigned_at IS NULL
            OR v_last_assigned_at IS NULL
            OR adc.last_assigned_at < v_last_assigned_at
          )
        )
      )
    ORDER BY adc.sort_order ASC, adc.last_assigned_at ASC NULLS FIRST
    LIMIT 1;

    IF v_next_agent.admin_user_id IS NULL THEN
      SELECT adc.* INTO v_next_agent
      FROM public.agent_distribution_caps adc
      JOIN public.admin_users au ON au.id = adc.admin_user_id
      WHERE au.is_active = true
        AND (adc.paused IS NULL OR adc.paused = false)
        AND au.role IN ('sales','sales_lead')
        AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
        AND public.is_agent_on_duty(adc.admin_user_id)
        AND COALESCE(adc.assignment_mode,'round_robin') = v_mode
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
      ORDER BY adc.sort_order ASC, adc.last_assigned_at ASC NULLS FIRST
      LIMIT 1;
    END IF;

    IF v_next_agent.admin_user_id IS NOT NULL THEN
      UPDATE public.agent_distribution_caps
      SET assigned_today = COALESCE(assigned_today,0)+1, last_assigned_at = v_now
      WHERE admin_user_id = v_next_agent.admin_user_id;

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
  END LOOP;

  IF p_team_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

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