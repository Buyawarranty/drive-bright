DO $do$
DECLARE
  v_def text;
  v_new text;
  v_fallback text := $f$
  -- ── Final safety net ─────────────────────────────────────────────────────
  -- Everyone switched on is over their daily cap (or off duty) and there is no
  -- overflow recipient. Rather than leaving the lead unassigned, give it to the
  -- switched-on sales agent with the fewest leads today. Agents that are
  -- switched off (paused) or on Open Pool are still never picked here.
  SELECT adc.* INTO v_next_agent
  FROM public.agent_distribution_caps adc
  JOIN public.admin_users au ON au.id = adc.admin_user_id
  WHERE au.is_active = true
    AND au.archived_at IS NULL
    AND COALESCE(adc.paused, false) = false
    AND au.role IN ('sales','sales_lead')
    AND COALESCE(adc.assignment_mode, 'round_robin') <> 'open_pool'
    AND (
      p_source IS NULL
      OR adc.allowed_sources IS NULL
      OR array_length(adc.allowed_sources, 1) IS NULL
      OR p_source = ANY(adc.allowed_sources)
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
  ORDER BY COALESCE(adc.assigned_today, 0) ASC,
           adc.last_assigned_at ASC NULLS FIRST,
           COALESCE(adc.sort_order, 999) ASC
  LIMIT 1;

  IF v_next_agent.admin_user_id IS NOT NULL THEN
    UPDATE public.agent_distribution_caps
    SET assigned_today = COALESCE(assigned_today, 0) + 1,
        last_assigned_at = v_now
    WHERE admin_user_id = v_next_agent.admin_user_id;

    IF v_rr_id IS NOT NULL THEN
      UPDATE public.round_robin_state
      SET last_assigned_user_id = v_next_agent.admin_user_id,
          updated_at = v_now
      WHERE id = v_rr_id;
    END IF;

    RETURN v_next_agent.admin_user_id;
  END IF;

  RETURN NULL;
END;
$function$$f$;
BEGIN
  v_def := pg_get_functiondef('public.pick_agent_for_distribution(uuid,text)'::regprocedure);
  v_new := regexp_replace(v_def, 'RETURN NULL;\s*END;\s*\$function\$\s*$', v_fallback);
  IF v_new = v_def THEN
    RAISE EXCEPTION 'could not locate trailing RETURN NULL in pick_agent_for_distribution';
  END IF;
  EXECUTE v_new;
END
$do$;