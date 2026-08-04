DO $mig$
DECLARE
  d text;
  d2 text;
  keep uuid;
BEGIN
  -- 1) Collapse stored cursors down to a single global row
  SELECT id INTO keep FROM public.round_robin_state
   ORDER BY (team_id IS NULL) DESC, updated_at DESC LIMIT 1;

  IF keep IS NOT NULL THEN
    UPDATE public.round_robin_state SET team_id = NULL WHERE id = keep;
    DELETE FROM public.round_robin_state WHERE id <> keep;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS round_robin_state_single_cursor
    ON public.round_robin_state ((true)) WHERE team_id IS NULL;

  -- 2) Strict rotation function: cursor is global, not per-team
  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'pick_agent_for_distribution'
    AND pg_get_function_identity_arguments(p.oid) = 'p_team_id uuid, p_source text';

  d2 := replace(d,
$old$  SELECT id, last_assigned_user_id
  INTO v_rr_id, v_last_agent_id
  FROM public.round_robin_state
  WHERE team_id IS NOT DISTINCT FROM p_team_id
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_rr_id IS NULL THEN
    INSERT INTO public.round_robin_state (last_assigned_user_id, updated_at, team_id)
    VALUES (NULL, v_now, p_team_id)
    RETURNING id INTO v_rr_id;
    v_last_agent_id := NULL;
  END IF;$old$,
$new$  -- Single global rotation cursor: team and global leads share one queue.
  SELECT id, last_assigned_user_id
  INTO v_rr_id, v_last_agent_id
  FROM public.round_robin_state
  WHERE team_id IS NULL
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_rr_id IS NULL THEN
    INSERT INTO public.round_robin_state (last_assigned_user_id, updated_at, team_id)
    VALUES (NULL, v_now, NULL)
    RETURNING id INTO v_rr_id;
    v_last_agent_id := NULL;
  END IF;$new$);

  IF d2 = d THEN
    RAISE EXCEPTION 'pick_agent_for_distribution cursor block not found';
  END IF;
  EXECUTE d2;

  -- 3) Legacy rotation function: same single cursor
  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'pick_agent_for_distribution_legacy';

  d2 := replace(d,
$old$  IF p_team_id IS NULL THEN
    SELECT id, last_assigned_user_id
      INTO v_rr_id, v_last_agent_id
    FROM public.round_robin_state
    WHERE team_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT id, last_assigned_user_id
      INTO v_rr_id, v_last_agent_id
    FROM public.round_robin_state
    WHERE team_id = p_team_id
    ORDER BY updated_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_rr_id IS NULL THEN
    INSERT INTO public.round_robin_state (last_assigned_user_id, updated_at, team_id)
    VALUES (NULL, v_now, p_team_id)
    RETURNING id INTO v_rr_id;
    v_last_agent_id := NULL;
  END IF;$old$,
$new$  -- Single global rotation cursor shared by team and global leads.
  SELECT id, last_assigned_user_id
    INTO v_rr_id, v_last_agent_id
  FROM public.round_robin_state
  WHERE team_id IS NULL
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_rr_id IS NULL THEN
    INSERT INTO public.round_robin_state (last_assigned_user_id, updated_at, team_id)
    VALUES (NULL, v_now, NULL)
    RETURNING id INTO v_rr_id;
    v_last_agent_id := NULL;
  END IF;$new$);

  IF d2 = d THEN
    RAISE EXCEPTION 'pick_agent_for_distribution_legacy cursor block not found';
  END IF;
  EXECUTE d2;
END
$mig$;