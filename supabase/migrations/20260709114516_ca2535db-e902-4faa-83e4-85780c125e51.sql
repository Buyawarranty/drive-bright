CREATE TABLE IF NOT EXISTS public.shark_tank_agent_caps (
  admin_user_id UUID PRIMARY KEY REFERENCES public.admin_users(id) ON DELETE CASCADE,
  daily_cap INT,
  total_cap INT,
  blocked BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.shark_tank_agent_caps TO authenticated;
GRANT ALL ON public.shark_tank_agent_caps TO service_role;
ALTER TABLE public.shark_tank_agent_caps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone reads shark_tank_agent_caps" ON public.shark_tank_agent_caps;
CREATE POLICY "Everyone reads shark_tank_agent_caps"
  ON public.shark_tank_agent_caps FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Management writes shark_tank_agent_caps" ON public.shark_tank_agent_caps;
CREATE POLICY "Management writes shark_tank_agent_caps"
  ON public.shark_tank_agent_caps FOR ALL TO authenticated
  USING (public.shark_tank_is_management())
  WITH CHECK (public.shark_tank_is_management());

DROP TRIGGER IF EXISTS trg_shark_tank_agent_caps_touch ON public.shark_tank_agent_caps;
CREATE TRIGGER trg_shark_tank_agent_caps_touch BEFORE UPDATE ON public.shark_tank_agent_caps
  FOR EACH ROW EXECUTE FUNCTION public.shark_tank_touch_updated_at();

CREATE OR REPLACE FUNCTION public.shark_tank_take_next(_team_id UUID)
RETURNS TABLE(lead_id UUID, held_until TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin_id UUID;
  v_hold_seconds INT;
  v_row public.shark_tank_pool%ROWTYPE;
  v_cap public.shark_tank_agent_caps%ROWTYPE;
  v_today INT;
  v_total INT;
BEGIN
  SELECT id INTO v_admin_id FROM public.admin_users WHERE user_id = auth.uid();
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF NOT public.shark_tank_is_active(_team_id) THEN RAISE EXCEPTION 'shark_tank_disabled_for_team'; END IF;

  SELECT * INTO v_cap FROM public.shark_tank_agent_caps WHERE admin_user_id = v_admin_id;
  IF v_cap.blocked THEN RAISE EXCEPTION 'agent_blocked_from_pool'; END IF;

  IF v_cap.daily_cap IS NOT NULL THEN
    SELECT COUNT(*) INTO v_today FROM public.shark_tank_audit
      WHERE actor_id = v_admin_id AND action = 'taken'
        AND created_at >= date_trunc('day', now());
    IF v_today >= v_cap.daily_cap THEN RAISE EXCEPTION 'daily_cap_reached'; END IF;
  END IF;

  IF v_cap.total_cap IS NOT NULL THEN
    SELECT COUNT(*) INTO v_total FROM public.shark_tank_audit
      WHERE actor_id = v_admin_id AND action = 'taken';
    IF v_total >= v_cap.total_cap THEN RAISE EXCEPTION 'total_cap_reached'; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.shark_tank_pool WHERE held_by=v_admin_id AND status IN ('held','retry_hold')) THEN
    RAISE EXCEPTION 'existing_hold';
  END IF;

  SELECT hold_seconds INTO v_hold_seconds FROM public.shark_tank_settings WHERE id=1;
  UPDATE public.shark_tank_pool p
    SET status='held', held_by=v_admin_id,
        held_until = now() + make_interval(secs => v_hold_seconds),
        attempt_count = attempt_count + 1
    WHERE p.id = (
      SELECT id FROM public.shark_tank_pool
       WHERE team_id=_team_id AND status='queued'
       ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RETURN; END IF;
  INSERT INTO public.shark_tank_audit(lead_id, actor_id, action, payload)
  VALUES (v_row.lead_id, v_admin_id, 'taken', jsonb_build_object('held_until', v_row.held_until));
  RETURN QUERY SELECT v_row.lead_id, v_row.held_until;
END $$;

CREATE OR REPLACE FUNCTION public.shark_tank_agent_stats()
RETURNS TABLE(
  admin_user_id UUID,
  taken_today INT,
  taken_total INT,
  claimed_today INT,
  claimed_total INT,
  last_taken_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    a.actor_id AS admin_user_id,
    COUNT(*) FILTER (WHERE a.action='taken' AND a.created_at >= date_trunc('day', now()))::int AS taken_today,
    COUNT(*) FILTER (WHERE a.action='taken')::int AS taken_total,
    COUNT(*) FILTER (WHERE a.action='claimed_owned' AND a.created_at >= date_trunc('day', now()))::int AS claimed_today,
    COUNT(*) FILTER (WHERE a.action='claimed_owned')::int AS claimed_total,
    MAX(a.created_at) FILTER (WHERE a.action='taken') AS last_taken_at
  FROM public.shark_tank_audit a
  WHERE a.actor_id IS NOT NULL
    AND public.shark_tank_is_management()
  GROUP BY a.actor_id
$$;

GRANT EXECUTE ON FUNCTION public.shark_tank_agent_stats() TO authenticated;