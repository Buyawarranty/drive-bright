DO $mig$
DECLARE
  v_def text;
  v_new text;
BEGIN
  -- 1. Open pool: a source-restricted agent must not be handed leads from
  --    sources they are not switched on for.
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'open_pool_get_next' LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'open_pool_get_next not found';
  END IF;

  v_new := replace(
    v_def,
    'AND (sl.eligible_at IS NULL',
    'AND public.agent_accepts_lead_source(_admin_id, sl.lead_source::text) AND (sl.eligible_at IS NULL'
  );
  IF v_new = v_def THEN
    RAISE EXCEPTION 'open_pool_get_next: source filter anchor not found';
  END IF;
  EXECUTE v_new;

  -- 2. Round robin (legacy + strict): alias-aware source matching, and the
  --    overflow recipients must respect the per-agent source switch too.
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'pick_agent_for_distribution_legacy' LIMIT 1;

  v_new := replace(
    v_def,
    'OR p_source = ANY(adc.allowed_sources)',
    'OR public.agent_accepts_lead_source(adc.admin_user_id, p_source)'
  );
  v_new := replace(
    v_new,
    'AND public.agent_works_new_leads(o.admin_user_id)',
    'AND public.agent_works_new_leads(o.admin_user_id) AND public.agent_accepts_lead_source(o.admin_user_id, p_source)'
  );
  IF v_new = v_def THEN
    RAISE EXCEPTION 'pick_agent_for_distribution_legacy: anchors not found';
  END IF;
  EXECUTE v_new;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'pick_agent_for_distribution'
    AND pg_get_function_identity_arguments(p.oid) = 'p_team_id uuid, p_source text' LIMIT 1;

  v_new := replace(
    v_def,
    'OR p_source = ANY(adc.allowed_sources)',
    'OR public.agent_accepts_lead_source(adc.admin_user_id, p_source)'
  );
  IF v_new = v_def THEN
    RAISE EXCEPTION 'pick_agent_for_distribution: anchor not found';
  END IF;
  EXECUTE v_new;
END
$mig$;