
CREATE OR REPLACE FUNCTION public.assign_recontact_leads_to_agent(
  _agent_id uuid,
  _batch_size integer DEFAULT 25
)
RETURNS TABLE(
  assigned_count integer,
  blocked_reason text,
  pool_remaining integer
)
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
  _min_age interval := interval '30 days';
BEGIN
  SELECT role INTO _caller_role
  FROM public.admin_users
  WHERE user_id = auth.uid() AND is_active = true
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
    ORDER BY sl.created_at ASC
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

  -- Best-effort audit log; ignore if table columns differ
  BEGIN
    INSERT INTO public.lead_assignment_audit (lead_id, assigned_to, assignment_type, assigned_by)
    SELECT sl.id, _agent_id, 'recontact_bulk_assign', auth.uid()
    FROM public.sales_leads sl
    WHERE sl.assigned_to = _agent_id
      AND sl.last_claimed_at >= now() - interval '5 seconds';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT COUNT(*)::int INTO _remaining
  FROM public.sales_leads
  WHERE assigned_to IS NULL
    AND status NOT IN ('lost','fake_lead','converted','archived')
    AND created_at < now() - _min_age;

  RETURN QUERY SELECT _assigned, NULL::text, _remaining;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.assign_recontact_leads_to_agent(uuid, integer) TO authenticated;
