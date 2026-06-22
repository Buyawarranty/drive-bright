
-- Per-agent allowed lead sources. NULL or empty array = agent accepts ALL sources (default).
ALTER TABLE public.agent_distribution_caps
  ADD COLUMN IF NOT EXISTS allowed_sources text[] NULL;

COMMENT ON COLUMN public.agent_distribution_caps.allowed_sources IS
  'Normalized lead sources this agent is allowed to receive (facebook, google, organic, tiktok, instagram, youtube, email, sms, referral, direct, other). NULL or empty = all sources allowed.';

-- Extend picker to filter by normalized source. NULL p_source preserves prior behavior.
CREATE OR REPLACE FUNCTION public.pick_agent_for_distribution(p_team_id uuid, p_source text DEFAULT NULL)
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
    IF p_team_id IS NULL
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

  SELECT EXISTS(
    SELECT 1
    FROM public.agent_distribution_caps adc
    JOIN public.admin_users au ON au.id = adc.admin_user_id
    WHERE au.is_active = true
      AND (adc.paused IS NULL OR adc.paused = false)
      AND au.role IN ('sales','sales_lead')
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
  ) INTO v_any_on_duty;

  IF NOT v_any_on_duty THEN
    v_force_overflow := true;
  END IF;

  IF COALESCE(v_settings.distribution_mode, 'round_robin') = 'percentage' AND NOT v_force_overflow THEN
    SELECT COALESCE(SUM(adc.assigned_today),0) INTO v_total_assigned_today
    FROM public.agent_distribution_caps adc
    JOIN public.admin_users au ON au.id = adc.admin_user_id
    WHERE au.is_active = true
      AND (adc.paused IS NULL OR adc.paused = false)
      AND au.role IN ('sales','sales_lead')
      AND COALESCE(adc.percentage,0) > 0
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
      );

    SELECT adc.* INTO v_next_agent
    FROM public.agent_distribution_caps adc
    JOIN public.admin_users au ON au.id = adc.admin_user_id
    WHERE au.is_active = true
      AND (adc.paused IS NULL OR adc.paused = false)
      AND au.role IN ('sales','sales_lead')
      AND COALESCE(adc.percentage,0) > 0
      AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
      AND public.is_agent_on_duty(adc.admin_user_id)
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

    v_force_overflow := true;
  END IF;

  IF NOT v_force_overflow THEN
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
  END IF;

  IF p_team_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, last_assigned_overflow_id INTO v_overflow_rr_id, v_last_overflow_id
  FROM public.overflow_round_robin_state WHERE team_id IS NULL LIMIT 1 FOR UPDATE;

  SELECT o.sort_order INTO v_last_overflow_sort
  FROM public.overflow_recipients o WHERE o.id = v_last_overflow_id;

  SELECT * INTO v_overflow_recipient
  FROM public.overflow_recipients
  WHERE is_active = true
    AND (v_last_overflow_sort IS NULL OR sort_order > v_last_overflow_sort)
  ORDER BY sort_order ASC, id ASC
  LIMIT 1;

  IF v_overflow_recipient IS NULL THEN
    SELECT * INTO v_overflow_recipient
    FROM public.overflow_recipients
    WHERE is_active = true
    ORDER BY sort_order ASC, id ASC
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

-- Update trigger to pass the normalized source through to the picker.
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
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('lost', 'fake_lead') THEN
    RETURN NEW;
  END IF;

  PERFORM public.reset_daily_caps();

  SELECT COALESCE((setting_value)::text::boolean, false)
    INTO v_routing_enabled
  FROM public.lead_settings
  WHERE setting_key = 'team_routing_enabled'
  LIMIT 1;

  v_source := CASE COALESCE(NEW.lead_source::text, 'unknown')
    WHEN 'social_ad' THEN 'facebook'
    WHEN 'google_ad' THEN 'google'
    WHEN 'website' THEN 'organic'
    ELSE COALESCE(NEW.lead_source::text, 'unknown')
  END;

  IF v_routing_enabled THEN
    FOR v_team_rule IN
      WITH eligible_rules AS (
        SELECT
          r.team_id,
          t.name AS team_name,
          r.priority,
          r.created_at,
          GREATEST(COALESCE(r.percentage, CASE WHEN r.allowed THEN 100 ELSE 0 END), 0)::numeric AS percentage
        FROM public.lead_team_source_rules r
        JOIN public.lead_teams t ON t.id = r.team_id
        WHERE r.allowed = true
          AND t.is_active = true
          AND r.source = v_source
          AND GREATEST(COALESCE(r.percentage, CASE WHEN r.allowed THEN 100 ELSE 0 END), 0) > 0
      ), team_counts AS (
        SELECT
          er.team_id,
          COUNT(sl.id)::numeric AS assigned_count
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
        SELECT COALESCE(SUM(assigned_count), 0) AS total_assigned
        FROM team_counts
      )
      SELECT er.team_id
      FROM eligible_rules er
      JOIN team_counts tc ON tc.team_id = er.team_id
      CROSS JOIN totals tot
      ORDER BY
        ((er.percentage / 100.0) * (tot.total_assigned + 1)) - tc.assigned_count DESC,
        er.priority ASC,
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
