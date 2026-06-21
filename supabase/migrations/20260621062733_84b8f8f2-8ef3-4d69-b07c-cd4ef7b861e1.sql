CREATE OR REPLACE FUNCTION public.simulate_lead_routing(p_source text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled boolean := false;
  v_rule RECORD;
  v_agent uuid;
  v_agent_name text;
  v_steps jsonb := '[]'::jsonb;
  v_source text;
BEGIN
  SELECT COALESCE((setting_value)::text::boolean, false)
    INTO v_enabled
  FROM public.lead_settings
  WHERE setting_key = 'team_routing_enabled'
  LIMIT 1;

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
      SELECT
        er.team_id,
        er.team_name,
        er.priority,
        er.percentage,
        tc.assigned_count,
        ((er.percentage / 100.0) * (tot.total_assigned + 1)) - tc.assigned_count AS need_score
      FROM eligible_rules er
      JOIN team_counts tc ON tc.team_id = er.team_id
      CROSS JOIN totals tot
      ORDER BY need_score DESC, er.priority ASC, er.created_at ASC
    LOOP
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

GRANT EXECUTE ON FUNCTION public.simulate_lead_routing(text) TO authenticated;