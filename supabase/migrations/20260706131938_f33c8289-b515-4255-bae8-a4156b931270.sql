CREATE OR REPLACE FUNCTION public.is_agent_receiving_enabled(p_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = au.id
    WHERE au.id = p_agent_id
      AND au.is_active = true
      AND au.role IN ('sales', 'sales_lead')
      AND COALESCE(adc.paused, false) = false
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_agent_cap(p_agent_id uuid, p_override boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent RECORD;
BEGIN
  SELECT au.id, au.is_active, au.role, COALESCE(adc.paused, false) AS paused
  INTO v_agent
  FROM public.admin_users au
  LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = au.id
  WHERE au.id = p_agent_id;

  IF v_agent.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'agent_not_found');
  END IF;

  IF v_agent.is_active IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'agent_inactive');
  END IF;

  IF v_agent.role NOT IN ('sales', 'sales_lead') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_sales_agent');
  END IF;

  IF v_agent.paused THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'agent_paused');
  END IF;

  -- Daily cap remains intentionally disabled; the Off switch is still enforced.
  RETURN jsonb_build_object('ok', true, 'reason', 'cap_disabled');
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_lead_to_agent(p_lead_id uuid, p_agent_id uuid, p_is_abandoned_cart boolean DEFAULT false, p_override_cap boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_admin RECORD;
  v_now timestamptz := now();
  v_rows_affected int;
  v_old_agent uuid;
  v_lead_email text;
  v_website_account_id uuid := 'e39499b8-f88c-4963-9f0d-63e1addb3025';
  v_can_override boolean := false;
  v_cap_check jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, role INTO v_caller_admin
  FROM public.admin_users
  WHERE user_id = v_caller_id AND is_active = true;

  IF v_caller_admin IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  v_can_override := v_caller_admin.role IN ('super_admin','admin','sales_manager','performance_manager');

  IF p_agent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id = p_agent_id AND is_active = true) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target agent not found or inactive');
    END IF;

    IF NOT p_is_abandoned_cart THEN
      v_cap_check := public.enforce_agent_cap(p_agent_id, p_override_cap AND v_can_override);
      IF NOT (v_cap_check->>'ok')::boolean THEN
        BEGIN
          INSERT INTO public.lead_assignment_audit (lead_id, from_user_id, to_user_id, changed_by, assignment_type, reason)
          VALUES (p_lead_id, NULL, p_agent_id, v_caller_admin.id, 'assignment_blocked', v_cap_check->>'reason');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        RETURN jsonb_build_object(
          'success', false,
          'error', v_cap_check->>'reason',
          'reason', v_cap_check->>'reason'
        );
      END IF;
    END IF;
  END IF;

  IF p_is_abandoned_cart THEN
    DECLARE
      v_auth_user_id uuid;
    BEGIN
      IF p_agent_id IS NOT NULL THEN
        SELECT user_id INTO v_auth_user_id FROM public.admin_users WHERE id = p_agent_id;
      END IF;

      UPDATE public.abandoned_carts
      SET contacted_by = v_auth_user_id,
          last_contacted_at = CASE WHEN v_auth_user_id IS NOT NULL THEN v_now ELSE NULL END,
          updated_at = v_now
      WHERE id = p_lead_id;

      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    END;
  ELSE
    SELECT assigned_to INTO v_old_agent FROM public.sales_leads WHERE id = p_lead_id;

    UPDATE public.sales_leads
    SET assigned_to = p_agent_id,
        assigned_at = CASE WHEN p_agent_id IS NOT NULL THEN v_now ELSE NULL END,
        updated_at = v_now
    WHERE id = p_lead_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    IF v_rows_affected > 0
       AND p_agent_id IS NOT NULL
       AND (v_old_agent IS NULL OR v_old_agent <> p_agent_id)
    THEN
      UPDATE public.agent_distribution_caps
      SET assigned_today = COALESCE(assigned_today, 0) + 1,
          last_assigned_at = v_now
      WHERE admin_user_id = p_agent_id;

      IF p_override_cap AND v_can_override THEN
        BEGIN
          INSERT INTO public.lead_assignment_audit (lead_id, from_user_id, to_user_id, changed_by, assignment_type, reason)
          VALUES (p_lead_id, v_old_agent, p_agent_id, v_caller_admin.id, 'cap_override', 'manual override');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
    END IF;

    IF v_rows_affected > 0 THEN
      SELECT lower(btrim(email)) INTO v_lead_email
      FROM public.sales_leads WHERE id = p_lead_id;

      IF v_lead_email IS NOT NULL AND v_lead_email != '' THEN
        IF p_agent_id IS NOT NULL THEN
          UPDATE public.customers
          SET assigned_to = p_agent_id,
              warranty_reference_number = CASE
                WHEN warranty_reference_number LIKE 'BAW-%' AND warranty_reference_number NOT LIKE 'BAW-S-%'
                THEN 'BAW-S-' || substring(warranty_reference_number from 5)
                ELSE warranty_reference_number
              END
          WHERE lower(btrim(email)) = v_lead_email
            AND (assigned_to IS NULL OR assigned_to = v_website_account_id);
        ELSE
          UPDATE public.customers
          SET assigned_to = NULL,
              warranty_reference_number = CASE
                WHEN warranty_reference_number LIKE 'BAW-S-%'
                THEN 'BAW-' || substring(warranty_reference_number from 7)
                ELSE warranty_reference_number
              END
          WHERE lower(btrim(email)) = v_lead_email
            AND assigned_to = v_old_agent;
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'assigned_to', p_agent_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_reassign_leads_to_agent(p_from_agent uuid, p_to_agent uuid, p_lead_ids uuid[] DEFAULT NULL::uuid[], p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT NULL::integer, p_override_cap boolean DEFAULT false, p_include_customers boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_admin RECORD;
  v_now timestamptz := now();
  v_ids uuid[];
  v_count int := 0;
  v_customers_count int := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, role INTO v_caller_admin
  FROM public.admin_users WHERE user_id = v_caller_id AND is_active = true;
  IF v_caller_admin IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF p_to_agent IS NULL OR NOT public.is_agent_receiving_enabled(p_to_agent) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target agent is switched off or inactive');
  END IF;

  IF p_lead_ids IS NOT NULL AND array_length(p_lead_ids, 1) > 0 THEN
    SELECT array_agg(id) INTO v_ids
    FROM public.sales_leads
    WHERE id = ANY(p_lead_ids) AND assigned_to IS DISTINCT FROM p_to_agent;
  ELSE
    SELECT array_agg(id) INTO v_ids FROM (
      SELECT id FROM public.sales_leads
      WHERE assigned_to = p_from_agent
        AND (p_date_from IS NULL OR created_at >= p_date_from)
        AND (p_date_to IS NULL OR created_at <= p_date_to)
      ORDER BY created_at DESC
      LIMIT COALESCE(p_limit, 100000)
    ) s;
  END IF;

  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('success', true, 'moved', 0, 'customers_moved', 0);
  END IF;

  UPDATE public.sales_leads
  SET assigned_to = p_to_agent, assigned_at = v_now, updated_at = v_now
  WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.agent_distribution_caps
  SET assigned_today = COALESCE(assigned_today,0) + v_count,
      last_assigned_at = v_now
  WHERE admin_user_id = p_to_agent;

  IF p_include_customers AND p_from_agent IS NOT NULL THEN
    UPDATE public.customers
    SET assigned_to = p_to_agent, updated_at = v_now
    WHERE assigned_to = p_from_agent;
    GET DIAGNOSTICS v_customers_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('success', true, 'moved', v_count, 'customers_moved', v_customers_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_sales_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next_user_id uuid;
  v_last_user_id uuid;
  v_last_sort_order integer;
  v_last_overflow_id uuid;
  v_last_overflow_sort integer;
  v_overflow_rr_id uuid;
BEGIN
  PERFORM public.reset_daily_caps();

  SELECT last_assigned_user_id INTO v_last_user_id
  FROM public.round_robin_state
  ORDER BY updated_at DESC NULLS LAST, id DESC
  LIMIT 1
  FOR UPDATE;

  SELECT adc.sort_order INTO v_last_sort_order
  FROM public.agent_distribution_caps adc
  WHERE adc.admin_user_id = v_last_user_id;

  SELECT adc.admin_user_id INTO v_next_user_id
  FROM public.agent_distribution_caps adc
  JOIN public.admin_users au ON au.id = adc.admin_user_id
  WHERE au.is_active = true
    AND au.role IN ('sales', 'sales_lead')
    AND COALESCE(adc.paused, false) = false
    AND (adc.daily_cap IS NULL OR COALESCE(adc.assigned_today, 0) < adc.daily_cap)
    AND (v_last_sort_order IS NULL OR adc.sort_order > v_last_sort_order)
  ORDER BY adc.sort_order ASC NULLS LAST
  LIMIT 1;

  IF v_next_user_id IS NULL THEN
    SELECT adc.admin_user_id INTO v_next_user_id
    FROM public.agent_distribution_caps adc
    JOIN public.admin_users au ON au.id = adc.admin_user_id
    WHERE au.is_active = true
      AND au.role IN ('sales', 'sales_lead')
      AND COALESCE(adc.paused, false) = false
      AND (adc.daily_cap IS NULL OR COALESCE(adc.assigned_today, 0) < adc.daily_cap)
    ORDER BY adc.sort_order ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_next_user_id IS NOT NULL THEN
    UPDATE public.round_robin_state
    SET last_assigned_user_id = v_next_user_id,
        updated_at = now()
    WHERE id = (
      SELECT id FROM public.round_robin_state
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT 1
    );

    IF NOT FOUND THEN
      INSERT INTO public.round_robin_state (last_assigned_user_id, updated_at)
      VALUES (v_next_user_id, now());
    END IF;

    RETURN v_next_user_id;
  END IF;

  SELECT ors.id, ors.last_assigned_overflow_id INTO v_overflow_rr_id, v_last_overflow_id
  FROM public.overflow_round_robin_state ors
  LIMIT 1;

  SELECT o.sort_order INTO v_last_overflow_sort
  FROM public.overflow_recipients o
  WHERE o.id = v_last_overflow_id;

  SELECT o.admin_user_id, o.id INTO v_next_user_id, v_last_overflow_id
  FROM public.overflow_recipients o
  JOIN public.admin_users au ON au.id = o.admin_user_id
  LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = o.admin_user_id
  WHERE o.is_active = true
    AND au.is_active = true
    AND au.role IN ('sales', 'sales_lead')
    AND COALESCE(adc.paused, false) = false
    AND (v_last_overflow_sort IS NULL OR o.sort_order > v_last_overflow_sort)
  ORDER BY o.sort_order ASC, o.id ASC
  LIMIT 1;

  IF v_next_user_id IS NULL THEN
    SELECT o.admin_user_id, o.id INTO v_next_user_id, v_last_overflow_id
    FROM public.overflow_recipients o
    JOIN public.admin_users au ON au.id = o.admin_user_id
    LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = o.admin_user_id
    WHERE o.is_active = true
      AND au.is_active = true
      AND au.role IN ('sales', 'sales_lead')
      AND COALESCE(adc.paused, false) = false
    ORDER BY o.sort_order ASC, o.id ASC
    LIMIT 1;
  END IF;

  IF v_next_user_id IS NOT NULL THEN
    IF v_overflow_rr_id IS NOT NULL THEN
      UPDATE public.overflow_round_robin_state
      SET last_assigned_overflow_id = v_last_overflow_id,
          updated_at = now()
      WHERE id = v_overflow_rr_id;
    ELSE
      INSERT INTO public.overflow_round_robin_state (last_assigned_overflow_id, updated_at)
      VALUES (v_last_overflow_id, now());
    END IF;
  END IF;

  RETURN v_next_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pick_agent_for_distribution(p_team_id uuid, p_source text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  SELECT o.* INTO v_overflow_recipient
  FROM public.overflow_recipients o
  JOIN public.admin_users au ON au.id = o.admin_user_id
  LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = o.admin_user_id
  WHERE o.is_active = true
    AND au.is_active = true
    AND au.role IN ('sales','sales_lead')
    AND COALESCE(adc.paused, false) = false
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
$$;

CREATE OR REPLACE FUNCTION public.claim_lead_for_agent(p_lead_id uuid, p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_agent_cap RECORD;
    v_lead RECORD;
    v_agent_role text;
    v_settings RECORD;
    v_now timestamp with time zone := now();
    v_is_solo_agent boolean := false;
    v_is_overflow boolean := false;
BEGIN
    SELECT * INTO v_settings FROM public.lead_distribution_settings LIMIT 1;
    v_is_solo_agent := (v_settings.solo_mode_enabled AND v_settings.solo_agent_id = p_agent_id);

    SELECT role INTO v_agent_role FROM public.admin_users WHERE id = p_agent_id AND is_active = true;

    IF v_agent_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agent not found.');
    END IF;

    IF v_agent_role = 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Administrators cannot claim leads.');
    END IF;

    SELECT * INTO v_lead FROM public.sales_leads WHERE id = p_lead_id;
    IF v_lead IS NULL THEN
        SELECT * INTO v_lead FROM public.abandoned_carts WHERE id = p_lead_id;
        IF v_lead IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Lead not found.');
        END IF;
    END IF;

    SELECT * INTO v_agent_cap FROM public.agent_distribution_caps WHERE admin_user_id = p_agent_id;

    IF v_agent_cap IS NULL THEN
        INSERT INTO public.agent_distribution_caps (admin_user_id, daily_cap, assigned_today, paused)
        VALUES (p_agent_id, 20, 0, false)
        RETURNING * INTO v_agent_cap;
    END IF;

    IF v_agent_cap.paused = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'Your lead receiving is currently paused.');
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.overflow_recipients o
        LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = o.admin_user_id
        JOIN public.admin_users au ON au.id = o.admin_user_id
        WHERE o.admin_user_id = p_agent_id
          AND o.is_active = true
          AND au.is_active = true
          AND COALESCE(adc.paused, false) = false
    ) INTO v_is_overflow;

    IF NOT v_is_solo_agent AND NOT v_is_overflow THEN
        IF v_agent_cap.daily_cap IS NOT NULL AND v_agent_cap.assigned_today >= v_agent_cap.daily_cap THEN
            RETURN jsonb_build_object('success', false, 'error', 'You have reached your daily lead cap.');
        END IF;
    END IF;

    UPDATE public.sales_leads
    SET assigned_to = p_agent_id, updated_at = v_now
    WHERE id = p_lead_id;

    UPDATE public.agent_distribution_caps
    SET assigned_today = assigned_today + 1, last_assigned_at = v_now
    WHERE admin_user_id = p_agent_id;

    RETURN jsonb_build_object('success', true, 'message', 'Lead successfully claimed!');
END;
$$;

UPDATE public.overflow_recipients o
SET is_active = false
FROM public.agent_distribution_caps adc
WHERE adc.admin_user_id = o.admin_user_id
  AND COALESCE(adc.paused, false) = true
  AND o.is_active = true;