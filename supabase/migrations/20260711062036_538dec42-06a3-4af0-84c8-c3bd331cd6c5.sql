
-- Enforce dry_run in the Open Lead Pool (shark tank) RPCs so the "Mode"
-- toggle in the UI actually controls behaviour end-to-end.
--
-- Rules:
--   * enabled = false  -> take_next raises 'shark_tank_disabled_for_team' (unchanged)
--   * enabled = true, dry_run = true  -> pool still populates on INSERT (audit intact),
--     but take_next raises 'shark_tank_dry_run' so no lead is locked.
--   * enabled = true, dry_run = false (Live) -> take_next locks a queued lead as before.

CREATE OR REPLACE FUNCTION public.shark_tank_take_next(_team_id UUID)
RETURNS TABLE(lead_id UUID, held_until TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin_id UUID;
  v_hold_seconds INT;
  v_row public.shark_tank_pool%ROWTYPE;
  v_enabled BOOLEAN;
  v_dry_run BOOLEAN;
  v_in_teams BOOLEAN;
BEGIN
  SELECT id INTO v_admin_id FROM public.admin_users WHERE user_id = auth.uid();
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'not_admin'; END IF;

  SELECT enabled, dry_run, (_team_id IS NOT NULL AND _team_id = ANY(team_ids))
    INTO v_enabled, v_dry_run, v_in_teams
    FROM public.shark_tank_settings WHERE id = 1;

  IF NOT COALESCE(v_enabled, false) OR NOT COALESCE(v_in_teams, false) THEN
    RAISE EXCEPTION 'shark_tank_disabled_for_team';
  END IF;
  IF COALESCE(v_dry_run, true) THEN
    -- Audit the blocked attempt so managers can see dry-run demand.
    INSERT INTO public.shark_tank_audit(lead_id, actor_id, action, payload)
    VALUES (gen_random_uuid(), v_admin_id, 'take_blocked_dry_run',
            jsonb_build_object('team_id', _team_id));
    RAISE EXCEPTION 'shark_tank_dry_run';
  END IF;

  IF EXISTS (SELECT 1 FROM public.shark_tank_pool WHERE held_by = v_admin_id AND status IN ('held','retry_hold')) THEN
    RAISE EXCEPTION 'existing_hold';
  END IF;

  SELECT hold_seconds INTO v_hold_seconds FROM public.shark_tank_settings WHERE id = 1;
  UPDATE public.shark_tank_pool p
    SET status = 'held', held_by = v_admin_id,
        held_until = now() + make_interval(secs => v_hold_seconds),
        attempt_count = attempt_count + 1
    WHERE p.id = (
      SELECT id FROM public.shark_tank_pool
       WHERE team_id = _team_id AND status = 'queued'
       ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RETURN; END IF;
  INSERT INTO public.shark_tank_audit(lead_id, actor_id, action, payload)
  VALUES (v_row.lead_id, v_admin_id, 'taken', jsonb_build_object('held_until', v_row.held_until));
  RETURN QUERY SELECT v_row.lead_id, v_row.held_until;
END $$;

GRANT EXECUTE ON FUNCTION public.shark_tank_take_next(UUID) TO authenticated;

-- Small helper the UI can call to know whether Live is on without exposing settings row.
CREATE OR REPLACE FUNCTION public.shark_tank_is_live()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(enabled, false) AND NOT COALESCE(dry_run, true)
  FROM public.shark_tank_settings WHERE id = 1;
$$;
GRANT EXECUTE ON FUNCTION public.shark_tank_is_live() TO authenticated;
