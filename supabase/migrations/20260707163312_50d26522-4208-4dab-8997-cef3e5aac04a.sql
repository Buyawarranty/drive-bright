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

  -- Paused/Off is bypassable by manager-level callers (super_admin/admin/sales_manager/performance_manager).
  IF v_agent.paused AND NOT p_override THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'agent_paused');
  END IF;

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
  v_effective_override boolean := false;
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
  -- Manager-level manual assignments always bypass the Paused/Off guard.
  v_effective_override := v_can_override OR (p_override_cap AND v_can_override);

  IF p_agent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id = p_agent_id AND is_active = true) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target agent not found or inactive');
    END IF;

    IF NOT p_is_abandoned_cart THEN
      v_cap_check := public.enforce_agent_cap(p_agent_id, v_effective_override);
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

      IF v_effective_override THEN
        BEGIN
          INSERT INTO public.lead_assignment_audit (lead_id, from_user_id, to_user_id, changed_by, assignment_type, reason)
          VALUES (p_lead_id, v_old_agent, p_agent_id, v_caller_admin.id, 'cap_override', 'manager manual assign (paused bypass allowed)');
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