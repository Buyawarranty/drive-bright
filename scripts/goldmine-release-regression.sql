DO $$
DECLARE
  staff record;
  target uuid;
  result record;
  definition text;
BEGIN
  definition := pg_get_functiondef('public.assign_recontact_leads_to_agent(uuid,integer)'::regprocedure);
  IF position('_batch_size > 100' in definition) = 0 OR position('ORDER BY sl.created_at DESC' in definition) = 0 THEN
    RAISE EXCEPTION 'Release limit or newest-first rule missing';
  END IF;
  SELECT au.id INTO target FROM public.admin_users au
  JOIN public.lead_team_members tm ON tm.admin_user_id=au.id
  WHERE au.is_active AND tm.workstream_recontact LIMIT 1;
  IF target IS NULL THEN RAISE EXCEPTION 'No active Goldmine agent to verify'; END IF;
  FOR staff IN SELECT user_id,role FROM public.admin_users
    WHERE is_active AND user_id IS NOT NULL AND role IN ('sales','sales_lead','sales_manager','admin','super_admin')
  LOOP
    PERFORM set_config('request.jwt.claim.sub',staff.user_id::text,true);
    PERFORM set_config('request.jwt.claims',json_build_object('sub',staff.user_id,'role','authenticated')::text,true);
    SELECT * INTO result FROM public.assign_recontact_leads_to_agent(target,101);
    IF staff.role IN ('admin','super_admin') THEN
      IF result.blocked_reason IS DISTINCT FROM 'batch_limit' OR result.assigned_count <> 0 THEN RAISE EXCEPTION 'Oversized admin release allowed'; END IF;
    ELSE
      IF result.blocked_reason IS DISTINCT FROM 'not_admin' OR result.assigned_count <> 0 THEN RAISE EXCEPTION 'Non-admin release allowed: %',staff.role; END IF;
    END IF;
    SELECT * INTO result FROM public.claim_recontact_leads_batch(100,true);
    IF result.blocked_reason IS DISTINCT FROM 'admin_release_required' OR result.claimed_count <> 0 THEN RAISE EXCEPTION 'Self-claim allowed'; END IF;
    BEGIN
      PERFORM public.claim_recontact_leads_self(ARRAY[target]);
      RAISE EXCEPTION 'Legacy self-claim unexpectedly accepted';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'admin_release_required' THEN RAISE; END IF;
    END;
  END LOOP;
END $$;