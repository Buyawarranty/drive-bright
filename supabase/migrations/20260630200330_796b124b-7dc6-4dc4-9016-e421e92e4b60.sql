
-- 1) Cap check helper
CREATE OR REPLACE FUNCTION public.enforce_agent_cap(p_agent_id uuid, p_override boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap RECORD;
BEGIN
  IF p_agent_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'no_agent');
  END IF;

  PERFORM public.reset_daily_caps();

  SELECT daily_cap, COALESCE(assigned_today,0) AS assigned_today
    INTO v_cap
  FROM public.agent_distribution_caps
  WHERE admin_user_id = p_agent_id;

  IF v_cap IS NULL OR v_cap.daily_cap IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'no_cap');
  END IF;

  IF v_cap.assigned_today >= v_cap.daily_cap AND NOT p_override THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'cap_reached',
      'current', v_cap.assigned_today,
      'cap', v_cap.daily_cap
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', CASE WHEN v_cap.assigned_today >= v_cap.daily_cap THEN 'override' ELSE 'under_cap' END,
    'current', v_cap.assigned_today,
    'cap', v_cap.daily_cap
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_agent_cap(uuid, boolean) TO authenticated, service_role;

-- 2) Replace assign_lead_to_agent with cap-aware version
CREATE OR REPLACE FUNCTION public.assign_lead_to_agent(
  p_lead_id uuid,
  p_agent_id uuid,
  p_is_abandoned_cart boolean DEFAULT false,
  p_override_cap boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  FROM admin_users
  WHERE user_id = v_caller_id AND is_active = true;

  IF v_caller_admin IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  v_can_override := v_caller_admin.role IN ('super_admin','admin','sales_manager','performance_manager');

  IF p_agent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE id = p_agent_id AND is_active = true) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target agent not found or inactive');
    END IF;

    -- Cap enforcement (skip for abandoned cart contact tagging — that doesn't consume a lead slot)
    IF NOT p_is_abandoned_cart THEN
      v_cap_check := public.enforce_agent_cap(p_agent_id, p_override_cap AND v_can_override);
      IF NOT (v_cap_check->>'ok')::boolean THEN
        BEGIN
          INSERT INTO public.lead_assignment_audit (lead_id, from_user_id, to_user_id, changed_by, assignment_type, reason)
          VALUES (p_lead_id, NULL, p_agent_id, v_caller_admin.id, 'cap_blocked',
                  format('current=%s cap=%s', v_cap_check->>'current', v_cap_check->>'cap'));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        RETURN jsonb_build_object(
          'success', false,
          'error', 'cap_reached',
          'current', v_cap_check->'current',
          'cap', v_cap_check->'cap'
        );
      END IF;
    END IF;
  END IF;

  IF p_is_abandoned_cart THEN
    DECLARE
      v_auth_user_id uuid;
    BEGIN
      IF p_agent_id IS NOT NULL THEN
        SELECT user_id INTO v_auth_user_id FROM admin_users WHERE id = p_agent_id;
      END IF;

      UPDATE abandoned_carts
      SET contacted_by = v_auth_user_id,
          last_contacted_at = CASE WHEN v_auth_user_id IS NOT NULL THEN v_now ELSE NULL END,
          updated_at = v_now
      WHERE id = p_lead_id;

      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    END;
  ELSE
    SELECT assigned_to INTO v_old_agent FROM sales_leads WHERE id = p_lead_id;

    UPDATE sales_leads
    SET assigned_to = p_agent_id,
        assigned_at = CASE WHEN p_agent_id IS NOT NULL THEN v_now ELSE NULL END,
        updated_at = v_now
    WHERE id = p_lead_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    -- Bump receiver's counter on ANY route where the target changed to a real agent
    IF v_rows_affected > 0
       AND p_agent_id IS NOT NULL
       AND (v_old_agent IS NULL OR v_old_agent <> p_agent_id)
    THEN
      UPDATE agent_distribution_caps
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
      FROM sales_leads WHERE id = p_lead_id;

      IF v_lead_email IS NOT NULL AND v_lead_email != '' THEN
        IF p_agent_id IS NOT NULL THEN
          UPDATE customers
          SET assigned_to = p_agent_id,
              warranty_reference_number = CASE
                WHEN warranty_reference_number LIKE 'BAW-%' AND warranty_reference_number NOT LIKE 'BAW-S-%'
                THEN 'BAW-S-' || substring(warranty_reference_number from 5)
                ELSE warranty_reference_number
              END
          WHERE lower(btrim(email)) = v_lead_email
            AND (is_deleted IS NULL OR is_deleted = false);

          UPDATE customer_policies
          SET quote_sent_by = p_agent_id
          WHERE lower(btrim(email)) = v_lead_email
            AND (is_deleted IS NULL OR is_deleted = false);
        ELSE
          UPDATE customers
          SET assigned_to = v_website_account_id,
              warranty_reference_number = CASE
                WHEN warranty_reference_number LIKE 'BAW-S-%'
                THEN 'BAW-' || substring(warranty_reference_number from 7)
                ELSE warranty_reference_number
              END
          WHERE lower(btrim(email)) = v_lead_email
            AND (is_deleted IS NULL OR is_deleted = false);
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'rows_affected', v_rows_affected);
END;
$$;

-- 3) Trigger: cap-aware pre-assigned inserts
CREATE OR REPLACE FUNCTION public.auto_assign_lead_round_robin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_rule RECORD;
  v_assigned uuid;
  v_routing_enabled boolean := false;
  v_source text;
  v_cap_check jsonb;
  v_preassigned uuid;
BEGIN
  IF NEW.status IN ('lost', 'fake_lead') THEN
    RETURN NEW;
  END IF;

  PERFORM public.reset_daily_caps();

  -- Pre-assigned (repeat customer / google ad re-attach / abandoned cart conversion)
  IF NEW.assigned_to IS NOT NULL THEN
    v_preassigned := NEW.assigned_to;
    v_cap_check := public.enforce_agent_cap(v_preassigned, false);

    IF (v_cap_check->>'ok')::boolean THEN
      -- under cap → keep and bump counter
      UPDATE public.agent_distribution_caps
      SET assigned_today = COALESCE(assigned_today,0) + 1,
          last_assigned_at = now()
      WHERE admin_user_id = v_preassigned;
      RETURN NEW;
    END IF;

    -- At cap → null assignment and fall through to round-robin
    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, from_user_id, to_user_id, changed_by, assignment_type, reason)
      VALUES (NEW.id, v_preassigned, NULL, NULL, 'cap_reroute',
              format('preassigned agent at cap (%s/%s)', v_cap_check->>'current', v_cap_check->>'cap'));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    NEW.assigned_to := NULL;
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
$$;

-- 4) Bulk reassign helper for the dialog
CREATE OR REPLACE FUNCTION public.bulk_reassign_leads_to_agent(
  p_from_agent uuid,
  p_to_agent uuid,
  p_lead_ids uuid[] DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT NULL,
  p_override_cap boolean DEFAULT false,
  p_include_customers boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_admin RECORD;
  v_can_override boolean := false;
  v_now timestamptz := now();
  v_ids uuid[];
  v_count int := 0;
  v_customers_count int := 0;
  v_cap RECORD;
  v_to_assign int;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, role INTO v_caller_admin
  FROM admin_users WHERE user_id = v_caller_id AND is_active = true;
  IF v_caller_admin IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  v_can_override := v_caller_admin.role IN ('super_admin','admin','sales_manager','performance_manager');

  IF p_to_agent IS NULL OR NOT EXISTS (SELECT 1 FROM admin_users WHERE id = p_to_agent AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target agent invalid');
  END IF;

  -- Resolve target lead ids
  IF p_lead_ids IS NOT NULL AND array_length(p_lead_ids, 1) > 0 THEN
    SELECT array_agg(id) INTO v_ids
    FROM sales_leads
    WHERE id = ANY(p_lead_ids) AND assigned_to IS DISTINCT FROM p_to_agent;
  ELSE
    SELECT array_agg(id) INTO v_ids FROM (
      SELECT id FROM sales_leads
      WHERE assigned_to = p_from_agent
        AND (p_date_from IS NULL OR created_at >= p_date_from)
        AND (p_date_to IS NULL OR created_at <= p_date_to)
      ORDER BY created_at DESC
      LIMIT COALESCE(p_limit, 100000)
    ) s;
  END IF;

  v_to_assign := COALESCE(array_length(v_ids, 1), 0);
  IF v_to_assign = 0 THEN
    RETURN jsonb_build_object('success', true, 'moved', 0, 'customers_moved', 0);
  END IF;

  -- Cap check
  PERFORM public.reset_daily_caps();
  SELECT daily_cap, COALESCE(assigned_today,0) AS assigned_today
    INTO v_cap
  FROM public.agent_distribution_caps WHERE admin_user_id = p_to_agent;

  IF v_cap.daily_cap IS NOT NULL
     AND (v_cap.assigned_today + v_to_assign) > v_cap.daily_cap
     AND NOT (p_override_cap AND v_can_override)
  THEN
    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, from_user_id, to_user_id, changed_by, assignment_type, reason)
      VALUES (NULL, p_from_agent, p_to_agent, v_caller_admin.id, 'cap_blocked',
              format('bulk %s would push %s past cap %s (current %s)', v_to_assign, p_to_agent, v_cap.daily_cap, v_cap.assigned_today));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'cap_reached',
      'attempting', v_to_assign,
      'current', v_cap.assigned_today,
      'cap', v_cap.daily_cap
    );
  END IF;

  UPDATE sales_leads
  SET assigned_to = p_to_agent, assigned_at = v_now, updated_at = v_now
  WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.agent_distribution_caps
  SET assigned_today = COALESCE(assigned_today,0) + v_count,
      last_assigned_at = v_now
  WHERE admin_user_id = p_to_agent;

  IF p_include_customers AND p_from_agent IS NOT NULL THEN
    UPDATE customers
    SET assigned_to = p_to_agent, updated_at = v_now
    WHERE assigned_to = p_from_agent;
    GET DIAGNOSTICS v_customers_count = ROW_COUNT;
  END IF;

  IF p_override_cap AND v_can_override AND v_cap.daily_cap IS NOT NULL
     AND (v_cap.assigned_today + v_to_assign) > v_cap.daily_cap THEN
    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, from_user_id, to_user_id, changed_by, assignment_type, reason)
      VALUES (NULL, p_from_agent, p_to_agent, v_caller_admin.id, 'cap_override',
              format('bulk %s past cap %s', v_to_assign, v_cap.daily_cap));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'moved', v_count, 'customers_moved', v_customers_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_reassign_leads_to_agent(uuid, uuid, uuid[], timestamptz, timestamptz, int, boolean, boolean) TO authenticated, service_role;
