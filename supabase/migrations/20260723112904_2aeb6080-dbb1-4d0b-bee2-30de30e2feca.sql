CREATE OR REPLACE FUNCTION public.bulk_reassign_leads_to_agent(p_from_agent uuid, p_to_agent uuid, p_lead_ids uuid[] DEFAULT NULL::uuid[], p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT NULL::integer, p_override_cap boolean DEFAULT false, p_include_customers boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_admin RECORD;
  v_target RECORD;
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

  -- Manager reassignment should not be blocked by the "Off" (paused) receiving switch.
  -- Only require that the target is an active sales agent.
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