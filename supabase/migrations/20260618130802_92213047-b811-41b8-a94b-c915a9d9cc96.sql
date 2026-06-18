CREATE OR REPLACE FUNCTION public.simulate_lead_routing(p_source text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled boolean := false;
  v_rule RECORD;
  v_team_name text;
  v_agent uuid;
  v_agent_name text;
  v_steps jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE((setting_value)::text::boolean, false)
    INTO v_enabled
  FROM public.lead_settings
  WHERE setting_key = 'team_routing_enabled'
  LIMIT 1;

  v_steps := v_steps || jsonb_build_object(
    'gate', 'master_switch',
    'state', CASE WHEN v_enabled THEN 'ARMED' ELSE 'OFF' END
  );

  IF v_enabled THEN
    FOR v_rule IN
      SELECT r.team_id, t.name AS team_name, r.priority
      FROM public.lead_team_source_rules r
      JOIN public.lead_teams t ON t.id = r.team_id
      WHERE r.allowed = true
        AND t.is_active = true
        AND r.source = COALESCE(p_source, 'unknown')
      ORDER BY r.priority ASC, r.created_at ASC
    LOOP
      v_agent := public.pick_agent_for_distribution(v_rule.team_id);
      v_steps := v_steps || jsonb_build_object(
        'gate', 'team_candidate',
        'team', v_rule.team_name,
        'priority', v_rule.priority,
        'picked_agent', v_agent
      );
      IF v_agent IS NOT NULL THEN
        SELECT COALESCE(full_name, email) INTO v_agent_name
        FROM public.admin_users WHERE user_id = v_agent;
        RETURN jsonb_build_object(
          'outcome', 'team_routed',
          'team', v_rule.team_name,
          'agent_id', v_agent,
          'agent_name', v_agent_name,
          'steps', v_steps
        );
      END IF;
    END LOOP;
  END IF;

  v_agent := public.pick_agent_for_distribution(NULL);
  SELECT COALESCE(full_name, email) INTO v_agent_name
  FROM public.admin_users WHERE user_id = v_agent;

  RETURN jsonb_build_object(
    'outcome', CASE WHEN v_agent IS NULL THEN 'no_agent_available' ELSE 'global_fallback' END,
    'agent_id', v_agent,
    'agent_name', v_agent_name,
    'steps', v_steps || jsonb_build_object('gate', 'global_fallback', 'picked_agent', v_agent)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.simulate_lead_routing(text) TO authenticated;