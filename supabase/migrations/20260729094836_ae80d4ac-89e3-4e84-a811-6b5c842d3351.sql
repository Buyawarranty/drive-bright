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
  v_from_release int := 0;
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

  -- How many of the leads being moved are currently owned by the source agent
  -- and were assigned today? Those come back off the source agent's daily count.
  IF p_from_agent IS NOT NULL THEN
    SELECT count(*) INTO v_from_release
    FROM public.sales_leads
    WHERE id = ANY(v_ids)
      AND assigned_to = p_from_agent
      AND COALESCE(assigned_at, created_at) >= date_trunc('day', v_now);
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

  IF p_from_agent IS NOT NULL AND v_from_release > 0 THEN
    UPDATE public.agent_distribution_caps
    SET assigned_today = GREATEST(COALESCE(assigned_today,0) - v_from_release, 0)
    WHERE admin_user_id = p_from_agent;
  END IF;

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

  RETURN jsonb_build_object(
    'success', true,
    'moved', v_count,
    'verified', v_verified_count,
    'customers_moved', v_customers_count
  );
END;
$function$;