CREATE OR REPLACE FUNCTION public.claim_recontact_leads_batch(_batch_size integer DEFAULT 200, _force boolean DEFAULT false)
 RETURNS TABLE(claimed_count integer, blocked_reason text, pending_count integer, pool_remaining integer, oldest_age_days integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
 SET lock_timeout TO '10s'
AS $function$
DECLARE
  _admin_id uuid;
  _admin_role text;
  _pending int;
  _claimed int := 0;
  _remaining int := 0;
  _oldest_days int := 0;
  _min_age interval := interval '60 days';
  _exempt boolean := false;
  _can_self boolean := false;
  _blocked boolean := false;
  _is_mgmt boolean := false;
BEGIN
  SELECT id, role INTO _admin_id, _admin_role
  FROM public.admin_users
  WHERE user_id = ( SELECT auth.uid() ) AND is_active = true
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RETURN QUERY SELECT 0, 'not_admin'::text, 0, 0, 0;
    RETURN;
  END IF;

  _is_mgmt := _admin_role IN ('admin','super_admin','sales_manager');

  SELECT COALESCE(can_self_assign, false), COALESCE(skip_batch_check, false), COALESCE(blocked, false)
    INTO _can_self, _exempt, _blocked
  FROM public.recontact_agent_caps
  WHERE admin_user_id = _admin_id;

  IF NOT _is_mgmt THEN
    IF _blocked THEN
      RETURN QUERY SELECT 0, 'recontact_off'::text, 0, 0, 0;
      RETURN;
    END IF;
    IF NOT COALESCE(_can_self, false) THEN
      RETURN QUERY SELECT 0, 'self_assign_not_allowed'::text, 0, 0, 0;
      RETURN;
    END IF;
  ELSE
    _exempt := true;
  END IF;

  IF _batch_size IS NULL OR _batch_size < 1 THEN _batch_size := 200; END IF;
  IF _batch_size > 200 THEN _batch_size := 200; END IF;

  IF NOT _exempt THEN
    SELECT COUNT(*) INTO _pending
    FROM public.sales_leads sl
    WHERE sl.assigned_to = _admin_id
      AND sl.status = 'new'
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_quick_notes lqn
        WHERE lqn.lead_id = sl.id
          AND lqn.created_at >= COALESCE(sl.assigned_at, sl.created_at)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_call_logs lcl
        WHERE lcl.lead_id = sl.id::text
          AND lcl.created_at >= COALESCE(sl.assigned_at, sl.created_at)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_activities la
        WHERE la.lead_id = sl.id
          AND la.created_at >= COALESCE(sl.assigned_at, sl.created_at)
      );

    IF _pending > 0 AND NOT _force THEN
      RETURN QUERY SELECT 0, 'pending_batch'::text, _pending, 0, 0;
      RETURN;
    END IF;
  END IF;

  WITH picked AS (
    SELECT sl.id
    FROM public.sales_leads sl
    WHERE sl.assigned_to IS NULL
      AND sl.status NOT IN ('lost','fake_lead','converted','archived')
      AND sl.created_at < now() - _min_age
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_quick_notes lqn
        WHERE lqn.lead_id = sl.id AND lqn.created_at > now() - _min_age
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_call_logs lcl
        WHERE lcl.lead_id = sl.id::text AND lcl.created_at > now() - _min_age
      )
    ORDER BY sl.created_at DESC
    LIMIT _batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.sales_leads sl
  SET assigned_to = _admin_id,
      assigned_at = now(),
      claim_count = COALESCE(sl.claim_count, 0) + 1,
      last_claimed_at = now(),
      updated_at = now()
  FROM picked p
  WHERE sl.id = p.id;

  GET DIAGNOSTICS _claimed = ROW_COUNT;

  SELECT COUNT(*)::int,
         COALESCE(EXTRACT(day FROM now() - MIN(sl.created_at))::int, 0)
    INTO _remaining, _oldest_days
  FROM public.sales_leads sl
  WHERE sl.assigned_to IS NULL
    AND sl.status NOT IN ('lost','fake_lead','converted','archived')
    AND sl.created_at < now() - _min_age
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_quick_notes lqn
      WHERE lqn.lead_id = sl.id AND lqn.created_at > now() - _min_age
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_call_logs lcl
      WHERE lcl.lead_id = sl.id::text AND lcl.created_at > now() - _min_age
    );

  RETURN QUERY SELECT _claimed, NULL::text, 0, _remaining, _oldest_days;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_recontact_leads_to_agent(_agent_id uuid, _batch_size integer DEFAULT 25)
 RETURNS TABLE(assigned_count integer, blocked_reason text, pool_remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
 SET lock_timeout TO '10s'
AS $function$
DECLARE
  _caller_role text;
  _agent_active boolean;
  _agent_on_recontact boolean;
  _assigned int := 0;
  _remaining int := 0;
  _min_age interval := interval '60 days';
BEGIN
  SELECT role INTO _caller_role
  FROM public.admin_users
  WHERE user_id = ( SELECT auth.uid() ) AND is_active = true
  LIMIT 1;

  IF _caller_role IS NULL OR _caller_role NOT IN ('admin','super_admin','sales_manager') THEN
    RETURN QUERY SELECT 0, 'not_management'::text, 0;
    RETURN;
  END IF;

  IF _agent_id IS NULL THEN
    RETURN QUERY SELECT 0, 'no_agent'::text, 0;
    RETURN;
  END IF;

  SELECT is_active INTO _agent_active
  FROM public.admin_users WHERE id = _agent_id;
  IF NOT COALESCE(_agent_active, false) THEN
    RETURN QUERY SELECT 0, 'agent_inactive'::text, 0;
    RETURN;
  END IF;

  SELECT COALESCE(workstream_recontact, false) INTO _agent_on_recontact
  FROM public.lead_team_members WHERE admin_user_id = _agent_id;
  IF NOT COALESCE(_agent_on_recontact, false) THEN
    RETURN QUERY SELECT 0, 'agent_not_on_recontact'::text, 0;
    RETURN;
  END IF;

  IF _batch_size IS NULL OR _batch_size < 1 THEN _batch_size := 25; END IF;
  IF _batch_size > 200 THEN _batch_size := 200; END IF;

  WITH picked AS (
    SELECT sl.id
    FROM public.sales_leads sl
    WHERE sl.assigned_to IS NULL
      AND sl.status NOT IN ('lost','fake_lead','converted','archived')
      AND sl.created_at < now() - _min_age
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_quick_notes lqn
        WHERE lqn.lead_id = sl.id AND lqn.created_at > now() - _min_age
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_call_logs lcl
        WHERE lcl.lead_id = sl.id::text AND lcl.created_at > now() - _min_age
      )
    ORDER BY sl.created_at DESC
    LIMIT _batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.sales_leads sl
  SET assigned_to = _agent_id,
      assigned_at = now(),
      claim_count = COALESCE(sl.claim_count, 0) + 1,
      last_claimed_at = now(),
      updated_at = now()
  FROM picked p
  WHERE sl.id = p.id;

  GET DIAGNOSTICS _assigned = ROW_COUNT;

  BEGIN
    INSERT INTO public.lead_assignment_audit (lead_id, assigned_to, assignment_type, assigned_by)
    SELECT sl.id, _agent_id, 'recontact_bulk_assign', ( SELECT auth.uid() )
    FROM public.sales_leads sl
    WHERE sl.assigned_to = _agent_id
      AND sl.last_claimed_at >= now() - interval '5 seconds';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT COUNT(*)::int INTO _remaining
  FROM public.sales_leads sl
  WHERE sl.assigned_to IS NULL
    AND sl.status NOT IN ('lost','fake_lead','converted','archived')
    AND sl.created_at < now() - _min_age
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_quick_notes lqn
      WHERE lqn.lead_id = sl.id AND lqn.created_at > now() - _min_age
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_call_logs lcl
      WHERE lcl.lead_id = sl.id::text AND lcl.created_at > now() - _min_age
    );

  RETURN QUERY SELECT _assigned, NULL::text, _remaining;
END;
$function$;

CREATE OR REPLACE FUNCTION public.count_recontact_leads_available()
 RETURNS TABLE(available_count integer, pool_total integer, oldest_age_days integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH pool AS (
    SELECT sl.id, sl.created_at
    FROM public.sales_leads sl
    WHERE sl.assigned_to IS NULL
      AND sl.status NOT IN ('lost','fake_lead','converted','archived')
      AND sl.created_at < now() - interval '60 days'
  ),
  no_contact AS (
    SELECT p.id, p.created_at
    FROM pool p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.lead_call_logs lcl
      WHERE lcl.lead_id = p.id::text AND lcl.created_at > now() - interval '60 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_quick_notes lqn
      WHERE lqn.lead_id = p.id AND lqn.created_at > now() - interval '60 days'
    )
  )
  SELECT
    (SELECT COUNT(*)::int FROM no_contact),
    (SELECT COUNT(*)::int FROM pool),
    COALESCE((SELECT EXTRACT(day FROM now() - MIN(created_at))::int FROM no_contact), 0);
$function$;