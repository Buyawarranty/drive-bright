CREATE OR REPLACE FUNCTION public.assign_lead_to_agent(p_lead_id uuid, p_agent_id uuid, p_is_abandoned_cart boolean DEFAULT false, p_override_cap boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid;
  v_caller_admin RECORD;
  v_now timestamptz := now();
  v_rows_affected int;
  v_old_agent uuid;
  v_final_agent uuid;
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
  v_effective_override := v_can_override OR (p_override_cap AND v_can_override);

  IF v_can_override THEN
    PERFORM set_config('app.allow_reassign', 'on', true);
  END IF;

  IF p_agent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id = p_agent_id AND is_active = true AND role IN ('sales','sales_lead')) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Target sales agent not found or inactive');
    END IF;

    IF NOT p_is_abandoned_cart THEN
      v_cap_check := public.enforce_agent_cap(p_agent_id, v_effective_override);
      IF NOT (v_cap_check->>'ok')::boolean THEN
        BEGIN
          INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
          VALUES (p_lead_id, p_agent_id, v_caller_admin.id::text, 'assignment_blocked', v_cap_check->>'reason');
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

    SELECT assigned_to INTO v_final_agent FROM public.sales_leads WHERE id = p_lead_id;

    IF v_rows_affected = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
    END IF;

    IF v_final_agent IS DISTINCT FROM p_agent_id THEN
      BEGIN
        INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (p_lead_id, p_agent_id, v_caller_admin.id::text, 'assignment_failed_verification', 'Assignment did not persist after database protection checks');
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Assignment did not persist after database protection checks. Use a manager account or the offboarding transfer tool.',
        'final_assigned_to', v_final_agent,
        'requested_assigned_to', p_agent_id
      );
    END IF;

    IF p_agent_id IS NOT NULL
       AND (v_old_agent IS NULL OR v_old_agent <> p_agent_id)
    THEN
      UPDATE public.agent_distribution_caps
      SET assigned_today = COALESCE(assigned_today, 0) + 1,
          last_assigned_at = v_now
      WHERE admin_user_id = p_agent_id;

      BEGIN
        INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (p_lead_id, p_agent_id, v_caller_admin.id::text, CASE WHEN v_effective_override THEN 'manager_manual_assign' ELSE 'manual_assign' END, 'Assignment verified after database write');
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
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
          WHERE lower(btrim(email)) = v_lead_email;
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'rows_affected', v_rows_affected);
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_reassign_leads_to_agent(p_from_agent uuid, p_to_agent uuid, p_lead_ids uuid[] DEFAULT NULL::uuid[], p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT NULL::integer, p_override_cap boolean DEFAULT false, p_include_customers boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid;
  v_caller_admin RECORD;
  v_target RECORD;
  v_now timestamptz := now();
  v_ids uuid[];
  v_count int := 0;
  v_verified_count int := 0;
  v_customers_count int := 0;
  v_can_override boolean := false;
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

  v_can_override := v_caller_admin.role IN ('super_admin','admin','sales_manager','performance_manager');

  IF v_can_override THEN
    PERFORM set_config('app.allow_reassign', 'on', true);
  END IF;

  IF p_to_agent IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target agent is required');
  END IF;

  SELECT id, is_active, role INTO v_target
  FROM public.admin_users WHERE id = p_to_agent;

  IF v_target.id IS NULL OR v_target.is_active IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target agent is inactive');
  END IF;

  IF v_target.role NOT IN ('sales', 'sales_lead') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target agent must be a sales agent');
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
    RETURN jsonb_build_object('success', true, 'moved', 0, 'verified', 0, 'customers_moved', 0);
  END IF;

  UPDATE public.sales_leads
  SET assigned_to = p_to_agent, assigned_at = v_now, updated_at = v_now
  WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT count(*) INTO v_verified_count
  FROM public.sales_leads
  WHERE id = ANY(v_ids) AND assigned_to = p_to_agent;

  IF v_verified_count <> COALESCE(array_length(v_ids, 1), 0) THEN
    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      SELECT id, p_to_agent, v_caller_admin.id::text, 'bulk_assignment_failed_verification', 'Bulk assignment did not persist after database protection checks'
      FROM public.sales_leads
      WHERE id = ANY(v_ids) AND assigned_to IS DISTINCT FROM p_to_agent;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Some leads did not persist after database protection checks. Use a manager account or the offboarding transfer tool.',
      'moved', v_count,
      'verified', v_verified_count,
      'requested', COALESCE(array_length(v_ids, 1), 0)
    );
  END IF;

  UPDATE public.agent_distribution_caps
  SET assigned_today = COALESCE(assigned_today,0) + v_verified_count,
      last_assigned_at = v_now
  WHERE admin_user_id = p_to_agent;

  IF p_include_customers AND p_from_agent IS NOT NULL THEN
    UPDATE public.customers
    SET assigned_to = p_to_agent, updated_at = v_now
    WHERE assigned_to = p_from_agent;
    GET DIAGNOSTICS v_customers_count = ROW_COUNT;
  END IF;

  BEGIN
    INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
    SELECT id, p_to_agent, v_caller_admin.id::text, 'bulk_manual_assign', 'Bulk assignment verified after database write'
    FROM public.sales_leads
    WHERE id = ANY(v_ids);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'moved', v_count, 'verified', v_verified_count, 'customers_moved', v_customers_count);
END;
$function$;