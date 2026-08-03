ALTER FUNCTION public.pick_agent_for_distribution(uuid, text)
RENAME TO pick_agent_for_distribution_legacy;

CREATE OR REPLACE FUNCTION public.pick_agent_for_distribution(
  p_team_id uuid,
  p_source text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_strict_enabled boolean := false;
  v_rr_id uuid;
  v_last_agent_id uuid;
  v_last_sort_order integer;
  v_next_agent_id uuid;
  v_now timestamptz := now();
BEGIN
  SELECT COALESCE(strict_rotation_enabled, false)
  INTO v_strict_enabled
  FROM public.lead_distribution_settings
  WHERE team_id IS NOT DISTINCT FROM p_team_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF p_team_id IS NOT NULL AND NOT COALESCE(v_strict_enabled, false) THEN
    SELECT COALESCE(strict_rotation_enabled, false)
    INTO v_strict_enabled
    FROM public.lead_distribution_settings
    WHERE team_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  IF NOT COALESCE(v_strict_enabled, false) THEN
    RETURN public.pick_agent_for_distribution_legacy(p_team_id, p_source);
  END IF;

  SELECT id, last_assigned_user_id
  INTO v_rr_id, v_last_agent_id
  FROM public.round_robin_state
  WHERE team_id IS NOT DISTINCT FROM p_team_id
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_rr_id IS NULL THEN
    INSERT INTO public.round_robin_state (last_assigned_user_id, updated_at, team_id)
    VALUES (NULL, v_now, p_team_id)
    RETURNING id INTO v_rr_id;
    v_last_agent_id := NULL;
  END IF;

  SELECT COALESCE(adc.sort_order, 999)
  INTO v_last_sort_order
  FROM public.agent_distribution_caps adc
  WHERE adc.admin_user_id = v_last_agent_id;

  SELECT adc.admin_user_id
  INTO v_next_agent_id
  FROM public.agent_distribution_caps adc
  JOIN public.admin_users au ON au.id = adc.admin_user_id
  WHERE au.is_active = true
    AND au.archived_at IS NULL
    AND au.role IN ('sales', 'sales_lead')
    AND COALESCE(adc.paused, false) = false
    AND COALESCE(adc.assignment_mode, 'round_robin') = 'round_robin'
    AND (
      p_source IS NULL
      OR adc.allowed_sources IS NULL
      OR array_length(adc.allowed_sources, 1) IS NULL
      OR p_source = ANY(adc.allowed_sources)
    )
    AND (
      (p_team_id IS NULL AND public.agent_works_new_leads(adc.admin_user_id))
      OR EXISTS (
        SELECT 1
        FROM public.lead_team_members ltm
        WHERE ltm.team_id = p_team_id
          AND ltm.admin_user_id = adc.admin_user_id
          AND ltm.workstream_new_leads = true
      )
    )
  ORDER BY
    CASE
      WHEN v_last_agent_id IS NULL OR v_last_sort_order IS NULL THEN 0
      WHEN (COALESCE(adc.sort_order, 999), adc.admin_user_id)
           > (v_last_sort_order, v_last_agent_id) THEN 0
      ELSE 1
    END,
    COALESCE(adc.sort_order, 999),
    adc.admin_user_id
  LIMIT 1;

  IF v_next_agent_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.agent_distribution_caps
  SET assigned_today = COALESCE(assigned_today, 0) + 1,
      last_assigned_at = v_now
  WHERE admin_user_id = v_next_agent_id;

  UPDATE public.round_robin_state
  SET last_assigned_user_id = v_next_agent_id,
      updated_at = v_now
  WHERE id = v_rr_id;

  RETURN v_next_agent_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_automatic_preassignment_before_round_robin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(NEW.manual_entry, false) AND NEW.assigned_to IS NOT NULL THEN
    NEW.assigned_to := NULL;
    NEW.owner_agent := NULL;
    NEW.assigned_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_clear_automatic_preassignment ON public.sales_leads;
CREATE TRIGGER trg_00_clear_automatic_preassignment
BEFORE INSERT ON public.sales_leads
FOR EACH ROW
EXECUTE FUNCTION public.clear_automatic_preassignment_before_round_robin();