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
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('lost', 'fake_lead') THEN
    RETURN NEW;
  END IF;

  PERFORM public.reset_daily_caps();

  -- GATE 1: master kill-switch. If OFF (default), skip team routing entirely
  -- and fall through to the existing global flow. This preserves live behaviour.
  SELECT COALESCE((setting_value)::text::boolean, false)
    INTO v_routing_enabled
  FROM public.lead_settings
  WHERE setting_key = 'team_routing_enabled'
  LIMIT 1;

  IF v_routing_enabled THEN
    -- GATE 2: source must have allowed=true rule on an active team.
    -- GATE 3: team must have a pickable agent (members + caps).
    FOR v_team_rule IN
      SELECT r.team_id
      FROM lead_team_source_rules r
      JOIN lead_teams t ON t.id = r.team_id
      WHERE r.allowed = true
        AND t.is_active = true
        AND r.source = COALESCE(NEW.lead_source::text, 'unknown')
      ORDER BY r.priority ASC, r.created_at ASC
    LOOP
      v_assigned := public.pick_agent_for_distribution(v_team_rule.team_id);
      IF v_assigned IS NOT NULL THEN
        NEW.assigned_to := v_assigned;
        RETURN NEW;
      END IF;
    END LOOP;
  END IF;

  -- Fallback: existing global behaviour (live Team Red flow)
  v_assigned := public.pick_agent_for_distribution(NULL);
  IF v_assigned IS NOT NULL THEN
    NEW.assigned_to := v_assigned;
  END IF;

  RETURN NEW;
END;
$function$;